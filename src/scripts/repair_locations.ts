/**
 * Rebuilds supplier locations after the old publishing bug, where every approved
 * address overwrote the supplier's single location (so most suppliers ended up
 * "in" whichever branch address was approved last).
 *
 * For every supplier from the batch lists it:
 *   1. removes locations the crawler created (supplier-provided ones are kept),
 *   2. puts back the city the supplier was listed under,
 *   3. re-adds each approved address as its own location.
 *
 * Run: npx tsx src/scripts/repair_locations.ts
 */
import "dotenv/config";
import { ProvenanceTypeEnum, VerificationStateEnum, LocationTypeEnum, ProfileStatusEnum } from "@prisma/client";
import { db } from "../lib/db";
import { publishLocationClaim, LocationPublishOutcome } from "../lib/locations/publish";
import { metroTowns, METRO_AREAS } from "../lib/locations/address";
import { BATCH_1_SUPPLIERS } from "./run_batch1_production";
import { BATCH_2_SUPPLIERS } from "./run_batch2_production";

async function cityCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const city of Object.keys(METRO_AREAS)) {
    out[city] = await db.supplierCompany.count({
      where: {
        profileStatus: ProfileStatusEnum.PUBLISHED,
        locations: { some: { OR: metroTowns(city).map((t) => ({ city: { equals: t, mode: "insensitive" as const } })) } },
      },
    });
  }
  return out;
}

async function main(): Promise<void> {
  console.log("Suppliers per city BEFORE:", await cityCounts());

  const tally: Record<LocationPublishOutcome, number> = { UPDATED_EXISTING: 0, FILLED_PLACEHOLDER: 0, ADDED: 0, SKIPPED: 0 };
  let repaired = 0;

  for (const cand of [...BATCH_1_SUPPLIERS, ...BATCH_2_SUPPLIERS]) {
    const supplier = await db.supplierCompany.findFirst({ where: { normalizedDomain: cand.domain } });
    if (!supplier) continue;

    const listedCity = cand.seedCity.split("/")[0]!.trim();

    await db.supplierLocation.deleteMany({
      where: { supplierCompanyId: supplier.id, provenance: ProvenanceTypeEnum.PUBLICLY_DISCOVERED },
    });
    await db.supplierLocation.create({
      data: {
        supplierCompanyId: supplier.id,
        locationType: LocationTypeEnum.HEADQUARTERS,
        addressLine1: `${listedCity} (listed city)`,
        city: listedCity,
        province: cand.seedProvince || "NB",
        country: "Canada",
        provenance: ProvenanceTypeEnum.PUBLICLY_DISCOVERED,
        verificationState: VerificationStateEnum.UNREVIEWED,
      },
    });

    const approved = await db.extractedClaim.findMany({
      where: {
        supplierCompanyId: supplier.id,
        claimType: "LOCATION",
        reviewState: { in: [VerificationStateEnum.APPROVED, VerificationStateEnum.AUTO_APPROVED] },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const claim of approved) {
      const state =
        claim.reviewState === VerificationStateEnum.APPROVED ? VerificationStateEnum.VERIFIED : VerificationStateEnum.AUTO_APPROVED;
      const outcome = await publishLocationClaim(supplier.id, claim.rawValue, claim.evidenceText, state);
      tally[outcome]++;
    }

    const locs = await db.supplierLocation.findMany({
      where: { supplierCompanyId: supplier.id },
      orderBy: [{ locationType: "asc" }, { createdAt: "asc" }],
    });
    console.log(`  ${supplier.canonicalName}: ${locs.map((l) => `${l.city}, ${l.province}`).join(" | ")}`);
    repaired++;
  }

  console.log(`\nRepaired ${repaired} suppliers. Address facts:`, tally);
  console.log("Suppliers per city AFTER (includes nearby towns):", await cityCounts());
  await db.$disconnect();
}

main().catch(async (err: unknown) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
