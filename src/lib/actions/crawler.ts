"use server";

import { getCurrentUserSession } from "@/lib/auth/session";
import { queueCrawlRun, QueueCrawlRunResult } from "@/lib/crawler/queue";

export async function queueCrawlAction(supplierCompanyId: string): Promise<QueueCrawlRunResult> {
  const session = await getCurrentUserSession();
  return await queueCrawlRun(supplierCompanyId, session);
}
