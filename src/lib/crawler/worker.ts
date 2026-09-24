import { db } from "@/lib/db";
import { CrawlStatusEnum, SourceTypeEnum, VerificationStateEnum } from "@prisma/client";
import { safeFetch } from "@/lib/crawler/fetcher";
import { crawlSite, toExtractorInput, withRetry, DEFAULT_MAX_SUBPAGES } from "@/lib/crawler/pipeline";
import { ExtractionEngine } from "@/lib/extraction/engine";
import { logger } from "@/lib/logger";

export interface ProcessJobResult {
  processed: boolean;
  crawlRunId?: string;
  pagesFetched?: number;
  claimsGenerated?: number;
  error?: string;
}

export interface ProcessJobOptions {
  /** Process this specific job instead of the oldest pending one. */
  crawlRunId?: string;
  /** How many subpages to read besides the home page. */
  maxSubpages?: number;
}

/**
 * Recover stale crawl jobs that have been stuck in RUNNING state
 * longer than staleThresholdMinutes (default: 5 minutes) due to process crashes.
 */
export async function recoverStaleCrawlJobs(staleThresholdMinutes = 5): Promise<number> {
  const cutoff = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
  try {
    const result = await db.crawlRun.updateMany({
      where: {
        status: CrawlStatusEnum.RUNNING,
        startedAt: { lt: cutoff },
      },
      data: {
        status: CrawlStatusEnum.PENDING,
        errorSummary: "Recovered from stale RUNNING state",
      },
    });
    if (result.count > 0) {
      logger.warn({ count: result.count }, "Recovered stale RUNNING crawl jobs back to PENDING");
    }
    return result.count;
  } catch (err) {
    logger.error({ err }, "Error recovering stale crawl jobs");
    return 0;
  }
}

/**
 * Removes facts that the system published on its own (never reviewed by a person) so a
 * fresh crawl replaces them instead of piling new facts on top of old mistakes.
 * Anything a person approved or rejected is kept.
 */
export async function clearSystemPublishedFacts(supplierCompanyId: string): Promise<void> {
  const systemStates = [VerificationStateEnum.AUTO_APPROVED, VerificationStateEnum.UNREVIEWED, VerificationStateEnum.PENDING];
  await db.$transaction([
    db.supplierCapability.deleteMany({ where: { supplierCompanyId, verificationState: { in: systemStates } } }),
    db.supplierIndustry.deleteMany({ where: { supplierCompanyId, verificationState: { in: systemStates } } }),
    db.supplierCertification.deleteMany({ where: { supplierCompanyId, verificationState: { in: systemStates } } }),
    db.supplierEquipment.deleteMany({ where: { supplierCompanyId, verificationState: { in: systemStates } } }),
    db.supplierServiceRegion.deleteMany({ where: { supplierCompanyId, verificationState: { in: systemStates } } }),
    db.supplierLocation.deleteMany({
      where: { supplierCompanyId, verificationState: { in: [VerificationStateEnum.AUTO_APPROVED] } },
    }),
    db.extractedClaim.deleteMany({
      where: {
        supplierCompanyId,
        reviewedByUserId: null,
        reviewState: { notIn: [VerificationStateEnum.HUMAN_APPROVED, VerificationStateEnum.HUMAN_REJECTED, VerificationStateEnum.VERIFIED, VerificationStateEnum.REJECTED, VerificationStateEnum.APPROVED] },
      },
    }),
  ]);
}

async function markFailed(crawlRunId: string, errorSummary: string, extra: { pagesDiscovered?: number; pagesFetched?: number; pagesRejected?: number } = {}) {
  try {
    await db.crawlRun.update({
      where: { id: crawlRunId },
      data: { status: CrawlStatusEnum.FAILED, completedAt: new Date(), errorSummary, ...extra },
    });
  } catch {
    // CrawlRun record may have been deleted or reset concurrently
  }
}

export async function processNextCrawlJob(options: ProcessJobOptions = {}): Promise<ProcessJobResult> {
  // 0. Recover any stale RUNNING jobs before claiming next job
  await recoverStaleCrawlJobs(5);

  // 1. Find the requested job, or the oldest PENDING job
  const pendingJob = await db.crawlRun.findFirst({
    where: { status: CrawlStatusEnum.PENDING, ...(options.crawlRunId ? { id: options.crawlRunId } : {}) },
    orderBy: { createdAt: "asc" },
    include: { supplierCompany: true },
  });

  if (!pendingJob) {
    return { processed: false };
  }

  // 2. Atomically claim job (PENDING -> RUNNING)
  const claimResult = await db.crawlRun.updateMany({
    where: { id: pendingJob.id, status: CrawlStatusEnum.PENDING },
    data: { status: CrawlStatusEnum.RUNNING, startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimResult.count === 0) {
    return { processed: false };
  }

  logger.info({ crawlRunId: pendingJob.id, seedUrl: pendingJob.seedUrl }, "Crawl job claimed by worker");

  const supplier = pendingJob.supplierCompany;
  const supplierDomain =
    supplier?.normalizedDomain ||
    (() => {
      try {
        return new URL(pendingJob.seedUrl).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })();

  try {
    // 3. Fetch and analyse the whole site before saving anything
    const site = await crawlSite(
      pendingJob.seedUrl,
      supplier?.canonicalName || "",
      supplierDomain,
      // Integration tests replace safeFetch with a mock, so look it up at call time.
      withRetry((url) => safeFetch(url), process.env.NODE_ENV === "test" ? [] : [2000, 6000]),
      options.maxSubpages ?? DEFAULT_MAX_SUBPAGES
    );

    const counts = {
      pagesDiscovered: site.pagesDiscovered,
      pagesFetched: site.pages.length,
      pagesRejected: site.rejected.length,
    };

    if (site.seedError && site.pages.length === 0 && site.identity.status !== "BLOCKED") {
      throw new Error(site.seedError);
    }

    if (site.identity.status !== "OK") {
      // A site that no longer belongs to the supplier must not keep feeding its profile.
      if (site.identity.status === "PARKED_OR_SPAM" || site.identity.status === "NAME_NOT_FOUND") {
        await clearSystemPublishedFacts(pendingJob.supplierCompanyId);
      }
      const summary = `Website check failed (${site.identity.status}): ${site.identity.reason}`;
      await markFailed(pendingJob.id, summary, counts);
      logger.warn({ crawlRunId: pendingJob.id, identity: site.identity }, "Crawl stopped by website identity check");
      return { processed: true, crawlRunId: pendingJob.id, pagesFetched: site.pages.length, error: summary };
    }

    // 4. Replace facts the system published on its own last time
    await clearSystemPublishedFacts(pendingJob.supplierCompanyId);

    // 5. Save pages and extract facts
    const engine = new ExtractionEngine();
    let claimsGenerated = 0;
    for (const page of site.pages) {
      const doc = await db.sourceDocument.create({
        data: {
          supplierCompanyId: pendingJob.supplierCompanyId,
          crawlRunId: pendingJob.id,
          sourceUrl: page.requestedUrl,
          canonicalUrl: page.parsed.canonicalUrl || page.finalUrl,
          sourceType: SourceTypeEnum.HTML,
          pageType: page.classification,
          title: page.parsed.title || page.classification,
          httpStatus: page.statusCode,
          mimeType: "text/html",
          contentHash: page.parsed.contentHash,
          extractedText: page.parsed.fullText || page.parsed.visibleText,
        },
      });
      const extracted = await engine.runExtraction(toExtractorInput(page, doc.id, pendingJob.supplierCompanyId, site.isRetail));
      claimsGenerated += extracted.length;
    }

    // 6. Automated claim validation layer
    try {
      const { validateAndProcessSupplierClaims } = await import("@/lib/validation/service");
      await validateAndProcessSupplierClaims(pendingJob.supplierCompanyId);
    } catch (valErr) {
      logger.warn({ valErr, supplierCompanyId: pendingJob.supplierCompanyId }, "Automated claim validation layer encountered error");
    }

    // 7. Done
    await db.crawlRun.update({
      where: { id: pendingJob.id },
      data: {
        status: CrawlStatusEnum.COMPLETED,
        completedAt: new Date(),
        ...counts,
        errorSummary: site.rejected.length > 0 ? `Skipped ${site.rejected.length} page(s): ${site.rejected.slice(0, 5).map((r) => `${r.url} (${r.reason})`).join("; ")}` : null,
      },
    });

    logger.info({ crawlRunId: pendingJob.id, pagesFetched: site.pages.length, claimsGenerated }, "Crawl job completed successfully");
    return { processed: true, crawlRunId: pendingJob.id, pagesFetched: site.pages.length, claimsGenerated };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Crawl processing error";
    logger.error({ err, crawlRunId: pendingJob.id }, "Crawl job processing failed");
    await markFailed(pendingJob.id, errorMsg);
    return { processed: true, crawlRunId: pendingJob.id, error: errorMsg };
  }
}
