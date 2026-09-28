/**
 * Shows what the crawler found for one supplier and what is published, to explain
 * why something is or isn't on the profile.
 *
 * Run: npx tsx src/scripts/check_supplier.ts aecom
 */
import "dotenv/config";
import { db } from "../lib/db";

async function main(): Promise<void> {
  const q = process.argv.slice(2).join(" ").trim();
  if (!q) throw new Error('Give part of the supplier name, e.g. npx tsx src/scripts/check_supplier.ts aecom');

  const supplier = await db.supplierCompany.findFirst({
    where: { canonicalName: { contains: q, mode: "insensitive" } },
    include: { crawlRuns: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!supplier) throw new Error(`No supplier matching "${q}"`);

  const run = supplier.crawlRuns[0];
  console.log(`\n${supplier.canonicalName} (${supplier.websiteUrl})`);
  console.log(
    run
      ? `Last crawl: ${run.createdAt.toISOString().slice(0, 16).replace("T", " ")} · ${run.status} · ${run.pagesFetched ?? 0} pages${run.errorSummary ? ` · ${run.errorSummary}` : ""}`
      : "Never crawled"
  );

  const claims = await db.extractedClaim.groupBy({
    by: ["claimType", "reviewState"],
    where: { supplierCompanyId: supplier.id },
    _count: { _all: true },
  });
  console.log("\nFacts found (type · state · count):");
  for (const c of claims.sort((a, b) => a.claimType.localeCompare(b.claimType))) {
    console.log(`  ${c.claimType.padEnd(16)} ${c.reviewState.padEnd(14)} ${c._count._all}`);
  }
  if (!claims.some((c) => c.claimType === "SERVICE_LISTED" || c.claimType === "SOCIAL")) {
    console.log("\n  → No listed services or social links yet: this supplier was crawled before the update. Run:");
    console.log(`    npx tsx src/scripts/recrawl_all.ts "${supplier.canonicalName}"`);
  }

  for (const type of ["SERVICE_LISTED", "SOCIAL"]) {
    const rows = await db.extractedClaim.findMany({
      where: { supplierCompanyId: supplier.id, claimType: type },
      distinct: ["normalizedValue"],
      select: { rawValue: true, reviewState: true },
      take: 25,
    });
    if (rows.length) console.log(`\n${type}:\n` + rows.map((r) => `  [${r.reviewState}] ${r.rawValue}`).join("\n"));
  }
  await db.$disconnect();
}

main().catch(async (err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  await db.$disconnect();
  process.exit(1);
});
