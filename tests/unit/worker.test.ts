import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { queueCrawlRun } from "@/lib/crawler/queue";
import { processNextCrawlJob } from "@/lib/crawler/worker";
import { UserSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import * as fetcher from "@/lib/crawler/fetcher";

const mockAdminSession: UserSession = {
  id: "usr_admin_unit",
  email: "admin@atlanticsource.ca",
  name: "Platform Admin",
  isPlatformAdmin: true,
  buyerMemberships: [],
  supplierMemberships: [],
};

describe("Crawler Queue & Worker Job Processing Unit Tests", () => {
  let unitSupplierId: string;

  beforeAll(async () => {
    vi.spyOn(fetcher, "safeFetch").mockImplementation(async (url: string) => ({
      url,
      statusCode: 200,
      headers: { "content-type": "text/html" },
      mimeType: "text/html",
      content: "<html><body><h1>Unit Test Page</h1><p>Structural steel and custom machining</p></body></html>",
      contentHash: "hash_test_987654",
      sizeBytes: 180,
    }));

    const company = await db.supplierCompany.create({
      data: {
        canonicalName: "Unit Test Supplier Ltd",
        slug: "unit-test-supplier-slug",
        websiteUrl: "https://unittest.example.com",
      },
    });
    unitSupplierId = company.id;
    await db.crawlRun.deleteMany({ where: { supplierCompanyId: unitSupplierId } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (unitSupplierId) {
      await db.supplierCompany.delete({ where: { id: unitSupplierId } }).catch(() => {});
    }
  });

  it("creates a QUEUED CrawlRun record via queueCrawlRun", async () => {
    const result = await queueCrawlRun(unitSupplierId, mockAdminSession);
    expect(result.success).toBe(true);
  });

  it("rejects non-admin session attempting to queue crawl", async () => {
    const nonAdminSession: UserSession = {
      id: "usr_buyer_1",
      email: "buyer@company.ca",
      name: "Buyer User",
      isPlatformAdmin: false,
      buyerMemberships: [],
      supplierMemberships: [],
    };
    const result = await queueCrawlRun(unitSupplierId, nonAdminSession);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unauthorized");
  });

  it("claims and processes a queued job cleanly", async () => {
    const jobResult = await processNextCrawlJob();
    expect(jobResult.processed).toBe(true);
    expect(jobResult.crawlRunId).toBeDefined();
  });
});
