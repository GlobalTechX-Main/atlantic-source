import { db } from "@/lib/db";
import { LocationTypeEnum, ProvenanceTypeEnum, VerificationStateEnum } from "@prisma/client";
import {
  parseAtlanticAddress,
  locationRoleFromEvidence,
  isNotACompanyLocation,
  isPlaceholderAddress,
  LocationRole,
} from "./address";

export type LocationPublishOutcome = "UPDATED_EXISTING" | "FILLED_PLACEHOLDER" | "ADDED" | "SKIPPED";

function typeForRole(role: LocationRole): LocationTypeEnum {
  if (role === "FACILITY") return LocationTypeEnum.PLANT;
  if (role === "HEADQUARTERS") return LocationTypeEnum.OFFICE;
  return LocationTypeEnum.BRANCH;
}

/**
 * Publishes one approved address fact as a supplier location.
 *
 * Each distinct address gets its own row, so a company with offices in Moncton and
 * Dartmouth keeps both instead of the last one overwriting the first. The city the
 * supplier was listed under is never replaced by a different city.
 */
export async function publishLocationClaim(
  supplierCompanyId: string,
  addressText: string,
  evidenceText: string | null | undefined,
  verificationState: VerificationStateEnum
): Promise<LocationPublishOutcome> {
  const role = locationRoleFromEvidence(evidenceText);
  if (isNotACompanyLocation(role)) return "SKIPPED";

  const parsed = parseAtlanticAddress(addressText);
  if (!parsed.city) return "SKIPPED";

  const address = addressText.trim().slice(0, 150);
  const existing = await db.supplierLocation.findMany({
    where: { supplierCompanyId },
    orderBy: { createdAt: "asc" },
  });

  const same = existing.find(
    (l) =>
      (parsed.postalCode && l.postalCode?.replace(/\s/g, "").toUpperCase() === parsed.postalCode.replace(/\s/g, "")) ||
      l.addressLine1.trim().toLowerCase() === address.toLowerCase()
  );
  if (same) {
    await db.supplierLocation.update({
      where: { id: same.id },
      data: { verificationState, postalCode: same.postalCode || parsed.postalCode },
    });
    return "UPDATED_EXISTING";
  }

  // The listing's placeholder row for this same city: fill in the real street address.
  const placeholder = existing.find(
    (l) => isPlaceholderAddress(l.addressLine1) && l.city.toLowerCase() === parsed.city!.toLowerCase()
  );
  if (placeholder) {
    await db.supplierLocation.update({
      where: { id: placeholder.id },
      data: {
        addressLine1: address,
        postalCode: parsed.postalCode,
        province: parsed.province || placeholder.province,
        verificationState,
      },
    });
    return "FILLED_PLACEHOLDER";
  }

  await db.supplierLocation.create({
    data: {
      supplierCompanyId,
      locationType: existing.length === 0 ? LocationTypeEnum.HEADQUARTERS : typeForRole(role),
      addressLine1: address,
      city: parsed.city,
      province: parsed.province || "NB",
      country: "Canada",
      postalCode: parsed.postalCode,
      provenance: ProvenanceTypeEnum.PUBLICLY_DISCOVERED,
      verificationState,
    },
  });
  return "ADDED";
}
