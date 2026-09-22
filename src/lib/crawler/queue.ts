import { db } from "@/lib/db";
import { UserSession } from "@/lib/auth/session";
import { CrawlStatusEnum } from "@prisma/client";
import { logger } from "@/lib/logger";

export interface QueueCrawlRunResult {
  success: boolean;
  crawlRunId?: string;
  error?: string;
}

export async function queueCrawlRun(
  supplierCompanyId: string,
  session: UserSession | null
): Promise<QueueCrawlRunResult> {
  // 1. RBAC Guard: Server-side Platform Admin Authority
  if (!session || !session.isPlatformAdmin) {
    return {
      success: false,
      error: "Unauthorized: Platform Admin privileges required to queue crawl runs",
    };
  }

  // 2. Validate supplier exists
  const supplier = await db.supplierCompany.findUnique({
    where: { id: supplierCompanyId },
  });

  if (!supplier) {
    return {
      success: false,
      error: "Supplier company not found",
    };
  }

  // 3. Validate HTTP/HTTPS website URL
  if (!supplier.websiteUrl || !supplier.websiteUrl.trim()) {
    return {
      success: false,
      error: `Supplier "${supplier.canonicalName}" does not have a website URL configured`,
    };
  }

  const websiteUrl = supplier.websiteUrl.trim();
  if (!websiteUrl.startsWith("http://") && !websiteUrl.startsWith("https://")) {
    return {
      success: false,
      error: `Supplier website URL "${websiteUrl}" must be a valid HTTP or HTTPS URL`,
    };
  }

  // 4. Prevent duplicate active crawl runs (PENDING or RUNNING)
  const existingActiveRun = await db.crawlRun.findFirst({
    where: {
      supplierCompanyId,
      status: { in: [CrawlStatusEnum.PENDING, CrawlStatusEnum.RUNNING] },
    },
  });

  if (existingActiveRun) {
    return {
      success: false,
      error: `A crawl job for "${supplier.canonicalName}" is already in ${existingActiveRun.status} state`,
    };
  }

  // 5. Create CrawlRun in PENDING state
  try {
    const crawlRun = await db.crawlRun.create({
      data: {
        supplierCompanyId,
        seedUrl: websiteUrl,
        status: CrawlStatusEnum.PENDING,
        attempts: 0,
        pagesDiscovered: 1,
        pagesFetched: 0,
        pagesRejected: 0,
      },
    });

    // 6. Log Audit Action
    const { logAdminAction } = await import("@/lib/admin/audit");
    await logAdminAction(
      session.id,
      "CRAWL_RUN_QUEUED",
      "CrawlRun",
      crawlRun.id,
      { supplierCompanyId, seedUrl: websiteUrl }
    );

    return {
      success: true,
      crawlRunId: crawlRun.id,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Database error while queueing crawl run";
    logger.error({ err, supplierCompanyId }, "Failed to queue CrawlRun");
    return {
      success: false,
      error: errorMsg,
    };
  }
}
