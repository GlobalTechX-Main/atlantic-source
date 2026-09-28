/**
 * Re-crawls every supplier website so profiles pick up everything the crawler can now read:
 * services as named on the site, social media pages, all office phone lines and general
 * emails, and office addresses. Facts a person approved or rejected are kept.
 *
 * Needs internet access and takes a few minutes (about 5–15 seconds per supplier).
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

  console.log(`Re-crawling ${suppliers.length} supplier website(s)...\n`);
  let ok = 0;
  for (const s of suppliers) {
    const run = await db.crawlRun.create({ data: { supplierCompanyId: s.id, seedUrl: s.websiteUrl!, status: "PENDING" } });
    const res = await processNextCrawlJob({ crawlRunId: run.id });
    if (res.error) {
      console.log(`  ✗ ${s.canonicalName}: ${res.error}`);
      continue;
    }
    ok++;
    const published = { supplierCompanyId: s.id, reviewState: { in: [VerificationStateEnum.APPROVED, VerificationStateEnum.AUTO_APPROVED] } };
    const [services, socials, contacts, caps] = await Promise.all([
      db.extractedClaim.findMany({ where: { ...published, claimType: "SERVICE_LISTED" }, distinct: ["normalizedValue"], select: { id: true } }),
      db.extractedClaim.findMany({ where: { ...published, claimType: "SOCIAL" }, distinct: ["normalizedValue"], select: { id: true } }),
      db.contact.count({ where: { supplierCompanyId: s.id } }),
      db.supplierCapability.count({ where: { supplierCompanyId: s.id, published: true } }),
    ]);
    console.log(
      `  ✓ ${s.canonicalName}: ${res.pagesFetched} pages · ${services.length} services listed · ${caps} capabilities · ${contacts} contacts · ${socials.length} social links`
    );
  }
  console.log(`\nDone: ${ok} of ${suppliers.length} crawled successfully.`);
  await db.$disconnect();
}

main().catch(async (err: unknown) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
