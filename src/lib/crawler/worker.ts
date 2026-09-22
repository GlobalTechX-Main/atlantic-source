import { db } from "@/lib/db";
import { CrawlStatusEnum, SourceTypeEnum } from "@prisma/client";
import { safeFetch } from "@/lib/crawler/fetcher";
import { parseAndSanitizeHtml } from "@/lib/crawler/parser";
import { discoverHighValueLinks } from "@/lib/crawler/discovery";
import { ExtractionEngine } from "@/lib/extraction/engine";
import { logger } from "@/lib/logger";

export interface ProcessJobResult {
  processed: boolean;
  crawlRunId?: string;
  pagesFetched?: number;
  claimsGenerated?: number;
  error?: string;
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

export async function processNextCrawlJob(): Promise<ProcessJobResult> {
  // 0. Recover any stale RUNNING jobs before claiming next job
  await recoverStaleCrawlJobs(5);

  // 1. Find oldest PENDING job
  const pendingJob = await db.crawlRun.findFirst({
    where: { status: CrawlStatusEnum.PENDING },
    orderBy: { createdAt: "asc" },
    include: { supplierCompany: true },
  });

  if (!pendingJob) {
    return { processed: false };
  }

  // 2. Atomically claim job (PENDING -> RUNNING)
  const claimResult = await db.crawlRun.updateMany({
    where: {
      id: pendingJob.id,
      status: CrawlStatusEnum.PENDING,
    },
    data: {
      status: CrawlStatusEnum.RUNNING,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  if (claimResult.count === 0) {
    return { processed: false };
  }

  logger.info({ crawlRunId: pendingJob.id, seedUrl: pendingJob.seedUrl }, "Crawl job claimed by worker");

  let pagesFetched = 0;
  let claimsGenerated = 0;
  const engine = new ExtractionEngine();

  try {
    // 3. Fetch Seed Page safely
    let seedHtml = "";
    let seedUrl = pendingJob.seedUrl;
    let seedStatusCode = 200;

    try {
      const fetchResult = await safeFetch(pendingJob.seedUrl);
      seedHtml = fetchResult.content;
      seedUrl = fetchResult.url || pendingJob.seedUrl;
      seedStatusCode = fetchResult.statusCode;
    } catch (err: unknown) {
      throw new Error(`Failed to fetch seed URL: ${err instanceof Error ? err.message : "Network error"}`);
    }

    const seedParsed = parseAndSanitizeHtml(seedHtml, seedUrl);

    // Save Seed SourceDocument
    const seedDoc = await db.sourceDocument.create({
      data: {
        supplierCompanyId: pendingJob.supplierCompanyId,
        crawlRunId: pendingJob.id,
        sourceUrl: pendingJob.seedUrl,
        canonicalUrl: seedParsed.canonicalUrl || pendingJob.seedUrl,
        sourceType: SourceTypeEnum.HTML,
        pageType: "HOME",
        title: seedParsed.title || "Home Page",
        httpStatus: seedStatusCode,
        mimeType: "text/html",
        contentHash: seedParsed.contentHash,
        extractedText: seedParsed.visibleText,
      },
    });
    pagesFetched++;

    // Extract Claims from Seed Page
    const seedClaims = await engine.runExtraction({
      sourceDocumentId: seedDoc.id,
      supplierCompanyId: pendingJob.supplierCompanyId,
      sourceUrl: pendingJob.seedUrl,
      pageTitle: seedParsed.title,
      visibleText: seedParsed.visibleText,
      headings: seedParsed.headings,
      jsonLdScripts: seedParsed.jsonLdScripts,
      mailtoLinks: seedParsed.mailtoLinks,
      telLinks: seedParsed.telLinks,
      canonicalUrl: seedParsed.canonicalUrl,
    });

    claimsGenerated += seedClaims.length;

    // 4. Discover High-Value Same-Domain Subpages
    const discoveredLinks = discoverHighValueLinks(seedHtml, pendingJob.seedUrl, 8);
    const pagesDiscovered = 1 + discoveredLinks.length;

    for (const link of discoveredLinks) {
      if (link.url === pendingJob.seedUrl) continue;

      try {
        const fetchResult = await safeFetch(link.url);
        if (!fetchResult.content) continue;

        const parsed = parseAndSanitizeHtml(fetchResult.content, fetchResult.url || link.url);

        const doc = await db.sourceDocument.create({
          data: {
            supplierCompanyId: pendingJob.supplierCompanyId,
            crawlRunId: pendingJob.id,
            sourceUrl: link.url,
            canonicalUrl: parsed.canonicalUrl || link.url,
            sourceType: SourceTypeEnum.HTML,
            pageType: link.classification,
            title: parsed.title || link.anchorText || link.classification,
            httpStatus: fetchResult.statusCode || 200,
            mimeType: "text/html",
            contentHash: parsed.contentHash,
            extractedText: parsed.visibleText,
          },
        });
        pagesFetched++;

        const extracted = await engine.runExtraction({
          sourceDocumentId: doc.id,
          supplierCompanyId: pendingJob.supplierCompanyId,
          sourceUrl: link.url,
          pageTitle: parsed.title,
          visibleText: parsed.visibleText,
          headings: parsed.headings,
          jsonLdScripts: parsed.jsonLdScripts,
          mailtoLinks: parsed.mailtoLinks,
          telLinks: parsed.telLinks,
          canonicalUrl: parsed.canonicalUrl,
        });

        claimsGenerated += extracted.length;
      } catch (err) {
        logger.warn({ err, url: link.url }, "Subpage crawl fetch failed");
      }
    }

    // 5. Automated Claim Validation Layer
    try {
      const { validateAndProcessSupplierClaims } = await import("@/lib/validation/service");
      await validateAndProcessSupplierClaims(pendingJob.supplierCompanyId);
    } catch (valErr) {
      logger.warn({ valErr, supplierCompanyId: pendingJob.supplierCompanyId }, "Automated claim validation layer encountered error");
    }

    // 6. Update CrawlRun to COMPLETED
    await db.crawlRun.update({
      where: { id: pendingJob.id },
      data: {
        status: CrawlStatusEnum.COMPLETED,
        completedAt: new Date(),
        pagesDiscovered,
        pagesFetched,
      },
    });

    logger.info(
      { crawlRunId: pendingJob.id, pagesFetched, claimsGenerated },
      "Crawl job completed successfully"
    );

    return {
      processed: true,
      crawlRunId: pendingJob.id,
      pagesFetched,
      claimsGenerated,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Crawl processing error";
    logger.error({ err, crawlRunId: pendingJob.id }, "Crawl job processing failed");

    try {
      await db.crawlRun.update({
        where: { id: pendingJob.id },
        data: {
          status: CrawlStatusEnum.FAILED,
          completedAt: new Date(),
          errorSummary: errorMsg,
        },
      });
    } catch {
      // CrawlRun record may have been deleted or reset concurrently
    }

    return {
      processed: true,
      crawlRunId: pendingJob.id,
      error: errorMsg,
    };
  }
}
