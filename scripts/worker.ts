// Background crawler worker: `npm run worker`.
// Polls the database for PENDING crawl jobs (queued from the admin console) and runs them one at a time.
import "dotenv/config";
import { processNextCrawlJob } from "../src/lib/crawler/worker";
import { db } from "../src/lib/db";
import { logger } from "../src/lib/logger";

const IDLE_WAIT_MS = 5000;
let stopping = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  logger.info({ pollIntervalMs: IDLE_WAIT_MS }, "Crawler worker started");
  while (!stopping) {
    try {
      const result = await processNextCrawlJob();
      if (!result.processed) {
        await sleep(IDLE_WAIT_MS);
        continue;
      }
      if (result.error) {
        logger.warn({ crawlRunId: result.crawlRunId, error: result.error }, "Crawl job finished with an error");
      } else {
        logger.info({ crawlRunId: result.crawlRunId, pagesFetched: result.pagesFetched, claims: result.claimsGenerated }, "Crawl job finished");
      }
    } catch (err) {
      logger.error({ err }, "Worker loop error");
      await sleep(IDLE_WAIT_MS);
    }
  }
  await db.$disconnect();
  logger.info("Crawler worker stopped");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

main().catch((err) => {
  logger.error({ err }, "Crawler worker crashed");
  process.exit(1);
});
