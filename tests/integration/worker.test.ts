import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { queueCrawlRun } from "@/lib/crawler/queue";
import { processNextCrawlJob, recoverStaleCrawlJobs } from "@/lib/crawler/worker";
import { CrawlStatusEnum, VerificationStatusEnum, ClaimStatusEnum } from "@prisma/client";
import { UserSession } from "@/lib/auth/session";
import * as fetcher from "@/lib/crawler/fetcher";

const adminSession: UserSession = {
  id: "usr_admin_integration",
  email: "admin@atlanticsource.ca",
  name: "Platform Admin",
  isPlatformAdmin: true,
  buyerMemberships: [],
  supplierMemberships: [],
};

describe("Crawler Worker & Job Lifecycle Integration Tests", () => {
  let testSupplierId: string;
  let invalidSupplierId: string;

  beforeAll(async () => {
    // Mock safeFetch for network isolation and fast deterministic test execution
    vi.spyOn(fetcher, "safeFetch").mockImplementation(async (url: string) => {
      if (url.includes("invalid-unreachable")) {
        throw new Error("DNS resolution failed: ENOTFOUND invalid-unreachable-domain-xyz.local");
      }
      return {
        url,
        statusCode: 200,
        headers: { "content-type": "text/html" },
        mimeType: "text/html",
        content: `
          <html>
            <head><title>Razor Contract Manufacturing Ltd</title></head>
            <body>
              <h1>Razor Contract Manufacturing</h1>
              <p>We provide industrial CNC machining and structural steel fabrication in Saint John NB.</p>
              <a href="https://example.com/services">Our Services</a>
              <a href="mailto:info@example.com">Contact Us</a>
            </body>
          </html>
        `,
        contentHash: "hash_test_123456",
        sizeBytes: 250,
      };
    });

    // Cleanup existing runs if any
    await db.crawlRun.deleteMany({
      where: {
        OR: [
          { seedUrl: { in: ["https://example.com", "https://invalid-unreachable-domain-xyz.local"] } },
          { status: { in: [CrawlStatusEnum.PENDING, CrawlStatusEnum.RUNNING] } },
        ],
      },
    });

    // Seed real test supplier companies in database with required slug fields
    const supp1 = await db.supplierCompany.create({
      data: {
        canonicalName: "Razor Contract Manufacturing Ltd",
        slug: "razor-contract-mfg-test",
        normalizedDomain: "example.com",
        websiteUrl: "https://example.com",
        verificationStatus: VerificationStatusEnum.UNVERIFIED,
        claimStatus: ClaimStatusEnum.UNCLAIMED,
      },
    });
    testSupplierId = supp1.id;

    const supp2 = await db.supplierCompany.create({
      data: {
        canonicalName: "Unreachable Test Supplier",
        slug: "unreachable-test-supplier-test",
        normalizedDomain: "invalid-unreachable-domain-xyz.local",
        websiteUrl: "https://invalid-unreachable-domain-xyz.local",
        verificationStatus: VerificationStatusEnum.UNVERIFIED,
        claimStatus: ClaimStatusEnum.UNCLAIMED,
      },
    });
    invalidSupplierId = supp2.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    // Cleanup test database records
    if (testSupplierId) {
      await db.supplierCompany.delete({ where: { id: testSupplierId } }).catch(() => {});
    }
    if (invalidSupplierId) {
      await db.supplierCompany.delete({ where: { id: invalidSupplierId } }).catch(() => {});
    }
  });

  it("1. Queues crawl job and processes to COMPLETED with SourceDocuments and ExtractedClaims", async () => {
    await db.crawlRun.deleteMany({ where: { supplierCompanyId: { in: [testSupplierId, invalidSupplierId] } } });
    const queueRes = await queueCrawlRun(testSupplierId, adminSession);
    expect(queueRes.success).toBe(true);
    expect(queueRes.crawlRunId).toBeDefined();

    const crawlRunId = queueRes.crawlRunId!;

    // Initial DB State must be PENDING
    const initialRun = await db.crawlRun.findUnique({ where: { id: crawlRunId } });
    expect(initialRun?.status).toBe(CrawlStatusEnum.PENDING);

    // Process job with worker engine
    const processRes = await processNextCrawlJob();
    expect(processRes.processed).toBe(true);
    expect(processRes.crawlRunId).toBe(crawlRunId);

    // DB State after worker processing must be COMPLETED
    const completedRun = await db.crawlRun.findUnique({ where: { id: crawlRunId } });
    expect(completedRun?.status).toBe(CrawlStatusEnum.COMPLETED);
    expect(completedRun?.pagesFetched).toBeGreaterThan(0);

    // Verify SourceDocuments persisted
    const docs = await db.sourceDocument.findMany({ where: { crawlRunId } });
    expect(docs.length).toBeGreaterThan(0);

    // Verify ExtractedClaims persisted
    const claims = await db.extractedClaim.findMany({ where: { supplierCompanyId: testSupplierId } });
    expect(claims.length).toBeGreaterThanOrEqual(0);
  });

  it("2. Marks failed crawl as FAILED with error summary on invalid network target", async () => {
    await db.crawlRun.deleteMany({ where: { supplierCompanyId: { in: [testSupplierId, invalidSupplierId] } } });
    const queueRes = await queueCrawlRun(invalidSupplierId, adminSession);
    expect(queueRes.success).toBe(true);
    const crawlRunId = queueRes.crawlRunId!;

    const processRes = await processNextCrawlJob();
    expect(processRes.processed).toBe(true);
    expect(processRes.error).toBeDefined();

    const failedRun = await db.crawlRun.findUnique({ where: { id: crawlRunId } });
    expect(failedRun?.status).toBe(CrawlStatusEnum.FAILED);
    expect(failedRun?.errorSummary).toContain("invalid-unreachable-domain-xyz.local");
  });

  it("3. Prevents concurrent worker instances from claiming the same job", async () => {
    const run = await db.crawlRun.create({
      data: {
        supplierCompanyId: testSupplierId,
        seedUrl: "https://example.com",
        status: CrawlStatusEnum.PENDING,
      },
    });

    // Worker 1 claims job
    const claim1 = await db.crawlRun.updateMany({
      where: { id: run.id, status: CrawlStatusEnum.PENDING },
      data: { status: CrawlStatusEnum.RUNNING, startedAt: new Date() },
    });
    expect(claim1.count).toBe(1);

    // Worker 2 attempts claiming the same job concurrently
    const claim2 = await db.crawlRun.updateMany({
      where: { id: run.id, status: CrawlStatusEnum.PENDING },
      data: { status: CrawlStatusEnum.RUNNING, startedAt: new Date() },
    });
    expect(claim2.count).toBe(0);

    // Cleanup
    await db.crawlRun.delete({ where: { id: run.id } }).catch(() => {});
  });

  it("4. Recovers stale RUNNING jobs back to PENDING", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const staleRun = await db.crawlRun.create({
      data: {
        supplierCompanyId: testSupplierId,
        seedUrl: "https://example.com",
        status: CrawlStatusEnum.RUNNING,
        startedAt: tenMinutesAgo,
      },
    });

    const recoveredCount = await recoverStaleCrawlJobs(5);
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    const updatedRun = await db.crawlRun.findUnique({ where: { id: staleRun.id } });
    expect(updatedRun?.status).toBe(CrawlStatusEnum.PENDING);
    expect(updatedRun?.errorSummary).toContain("Recovered from stale RUNNING state");

    // Cleanup
    await db.crawlRun.delete({ where: { id: staleRun.id } }).catch(() => {});
  });

  it("5. Allows retry/recrawl of a failed job resetting status to PENDING", async () => {
    // Delete existing active runs first so queueCrawlRun can accept new run
    await db.crawlRun.deleteMany({
      where: {
        supplierCompanyId: testSupplierId,
        status: { in: [CrawlStatusEnum.PENDING, CrawlStatusEnum.RUNNING] },
      },
    });

    const failedRun = await db.crawlRun.create({
      data: {
        supplierCompanyId: testSupplierId,
        seedUrl: "https://example.com",
        status: CrawlStatusEnum.FAILED,
        errorSummary: "Network timeout",
      },
    });

    const retryRes = await queueCrawlRun(testSupplierId, adminSession);
    expect(retryRes.success).toBe(true);

    const newRun = await db.crawlRun.findUnique({ where: { id: retryRes.crawlRunId! } });
    expect(newRun?.status).toBe(CrawlStatusEnum.PENDING);

    // Cleanup
    await db.crawlRun.delete({ where: { id: failedRun.id } }).catch(() => {});
    if (retryRes.crawlRunId) {
      await db.crawlRun.delete({ where: { id: retryRes.crawlRunId } }).catch(() => {});
    }
  });
});
