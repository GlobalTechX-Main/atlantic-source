import { ProfileQAResult, SupplierQAFlag } from "./types";
import { db } from "@/lib/db";

/**
 * Runs a profile-level consistency QA check across a supplier's extracted claims and persisted facts.
 * Flags inconsistencies for admin review without automatically inventing or mutating data.
 */
export async function runSupplierProfileQA(supplierCompanyId: string): Promise<ProfileQAResult> {
  const flags: SupplierQAFlag[] = [];

  const supplier = await db.supplierCompany.findUnique({
    where: { id: supplierCompanyId },
    include: {
      locations: true,
      contacts: true,
      extractedClaims: true,
      capabilities: { include: { capability: true } },
    },
  });

  if (!supplier) {
    return {
      supplierCompanyId,
      supplierName: "Unknown Supplier",
      hasInconsistencies: false,
      qaFlags: [],
    };
  }

  // 1. Contradictory Locations Check
  if (supplier.locations.length > 2) {
    const hqCount = supplier.locations.filter((l) => l.locationType === "HEADQUARTERS").length;
    if (hqCount > 1) {
      flags.push({
        code: "CONTRADICTORY_PRIMARY_LOCATIONS",
        severity: "WARNING",
        message: `Supplier has ${hqCount} locations marked as HEADQUARTERS. Verify main location.`,
      });
    }
  }

  // 2. Duplicate Contacts Check
  const emailSet = new Set<string>();
  for (const contact of supplier.contacts) {
    const email = contact.normalizedEmail || contact.publicBusinessEmail;
    if (email) {
      const lower = email.toLowerCase();
      if (emailSet.has(lower)) {
        flags.push({
          code: "DUPLICATE_CONTACT_EMAIL",
          severity: "WARNING",
          message: `Duplicate contact email found: ${email}`,
        });
      } else {
        emailSet.add(lower);
      }
    }
  }

  // 3. Unsupported Capabilities Check (Claims rejected or missing evidence)
  const rejectedCapClaims = supplier.extractedClaims.filter(
    (c) => c.claimType === "CAPABILITY" && (c.reviewState === "REJECTED" || c.reviewState === "AUTO_REJECTED")
  );
  if (rejectedCapClaims.length > 0) {
    flags.push({
      code: "UNSUPPORTED_CAPABILITY_CLAIMS",
      severity: "WARNING",
      message: `${rejectedCapClaims.length} capability claims were rejected during validation.`,
      affectedClaimIds: rejectedCapClaims.map((c) => c.id),
    });
  }

  // 4. Wrong Company / Third-Party Mentions
  const thirdPartyClaims = supplier.extractedClaims.filter(
    (c) => c.validationReason?.includes("third-party") || c.validationReason?.includes("subcontracted")
  );
  if (thirdPartyClaims.length > 0) {
    flags.push({
      code: "THIRD_PARTY_EVIDENCE_MENTION",
      severity: "CRITICAL",
      message: `${thirdPartyClaims.length} extracted claims mention third-party or subcontracted entities.`,
      affectedClaimIds: thirdPartyClaims.map((c) => c.id),
    });
  }

  return {
    supplierCompanyId,
    supplierName: supplier.canonicalName,
    hasInconsistencies: flags.length > 0,
    qaFlags: flags,
  };
}
