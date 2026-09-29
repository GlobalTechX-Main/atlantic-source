/**
 * Re-crawls every supplier website so profiles pick up everything the crawler can now read:
 * services as named on the site, social media pages, all office phone lines and general
 * emails, and office addresses. Facts a person approved or rejected are kept.
 *
 * Reads each website's useful pages in full plus a sample of news, jobs and product pages
 * (up to CRAWL_MAX_PAGES pages, 150 by default), 5 suppliers at a time
 * (CRAWL_PARALLEL_SUPPLIERS). All 51 suppliers take roughly 10–20 minutes. Needs internet.
 * Run: npx tsx src/scripts/recrawl_all.ts
 * Only some suppliers: npx tsx src/scripts/recrawl_all.ts "black & mcdonald" irving
 */
import "dotenv/config";
import { VerificationStateEnum } from "@prisma/client";
import { db } from "../lib/db";
import { processNextCrawlJob } from "../lib/crawler/worker";

async function main(): Promise<void> {
  const filters = process.argv.slice(2).map((f) => f.toLowerCase());
  const suppliers = (
    await db.supplierCompany.findMany({
      where: { websiteUrl: { not: null } },
      select: { id: true, canonicalName: true, websiteUrl: true },
      orderBy: { canonicalName: "asc" },
    })
  ).filter((s) => !(s.websiteUrl || "").includes(".example.") && (filters.length === 0 || filters.some((f) => s.canonicalName.toLowerCase().includes(f))));

  console.log(
    `Re-crawling ${suppliers.length} supplier website(s), ${Number(process.env.CRAWL_PARALLEL_SUPPLIERS) || 5} at a time (up to ${process.env.CRAWL_MAX_PAGES || 150} pages each)...\n`
  );
  // Several suppliers at once: each is a different web server, so this is much faster
  // without putting more load on any one site.
  const parallel = Math.max(1, Number(process.env.CRAWL_PARALLEL_SUPPLIERS) || 5);
  const started = Date.now();
  let ok = 0;
  let next = 0;
  const crawlOne = async (s: (typeof suppliers)[number]) => {
    const run = await db.crawlRun.create({ data: { supplierCompanyId: s.id, seedUrl: s.websiteUrl!, status: "PENDING" } });
    const res = await processNextCrawlJob({ crawlRunId: run.id });
    if (res.error) {
      console.log(`  ✗ ${s.canonicalName}: ${res.error}`);
      return;
    }
    ok++;
    const published = { supplierCompanyId: s.id, reviewState: { in: [VerificationStateEnum.APPROVED, VerificationStateEnum.AUTO_APPROVED] } };
    const [services, socials, contacts, caps, hours] = await Promise.all([
      db.extractedClaim.findMany({ where: { ...published, claimType: "SERVICE_LISTED" }, distinct: ["normalizedValue"], select: { id: true } }),
      db.extractedClaim.findMany({ where: { ...published, claimType: "SOCIAL" }, distinct: ["normalizedValue"], select: { id: true } }),
      db.contact.count({ where: { supplierCompanyId: s.id } }),
      db.supplierCapability.count({ where: { supplierCompanyId: s.id, published: true } }),
      db.extractedClaim.findMany({ where: { ...published, claimType: "BUSINESS_HOURS" }, distinct: ["normalizedValue"], select: { id: true } }),
    ]);
    console.log(
      `  ✓ ${s.canonicalName}: ${res.pagesFetched} pages · ${services.length} services listed · ${caps} capabilities · ${contacts} contacts · ${socials.length} social links · ${hours.length} opening-hours lines`
    );
  };
  await Promise.all(
    Array.from({ length: Math.min(parallel, suppliers.length) }, async () => {
      while (next < suppliers.length) {
        const s = suppliers[next++]!;
        try {
          await crawlOne(s);
        } catch (err) {
          console.log(`  ✗ ${s.canonicalName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    })
  );
  console.log(`\nTime taken: ${Math.round((Date.now() - started) / 60000)} min`);
  console.log(`\nDone: ${ok} of ${suppliers.length} crawled successfully.`);
  await db.$disconnect();
}

main().catch(async (err: unknown) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
