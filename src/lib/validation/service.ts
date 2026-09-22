import { db } from "@/lib/db";
import { defaultClaimValidator } from "./claimValidator";
import { approveClaim } from "@/lib/admin/publishing";
import { logger } from "@/lib/logger";
import { consolidateExtractedClaims, CanonicalClaimFact } from "./consolidation";
import { applySupplierRfqContactSelection } from "@/lib/contacts/selection";

export interface BatchValidationStats {
  totalProcessed: number;
  uniqueCanonicalFacts: number;
  autoApproved: number;
  autoRejected: number;
  needsHumanReview: number;
  publishedCount: number;
  collapsedDuplicates: number;
}

/**
 * Validates unreviewed extracted claims for a supplier company after grouping into Canonical Facts.
 * Automatically approves & publishes LOW-risk facts via the Publishing Service,
 * auto-rejects LOW-risk invalid/negated claims, and queues uncertain claims for HUMAN_REVIEW.
 */
export async function validateAndProcessSupplierClaims(
  supplierCompanyId: string,
  reprocessAll = false
): Promise<BatchValidationStats> {
  const stats: BatchValidationStats = {
    totalProcessed: 0,
    uniqueCanonicalFacts: 0,
    autoApproved: 0,
    autoRejected: 0,
    needsHumanReview: 0,
    publishedCount: 0,
    collapsedDuplicates: 0,
  };

  const unreviewedClaims = await db.extractedClaim.findMany({
    where: {
      supplierCompanyId,
      ...(reprocessAll ? { reviewedByUserId: null } : { reviewState: "UNREVIEWED" }),
    },
    include: {
      supplierCompany: { select: { canonicalName: true, normalizedDomain: true } },
      sourceDocument: { select: { sourceUrl: true, pageType: true, extractedText: true } },
    },
    take: 500, // Bounded batch limit
  });
  if (unreviewedClaims.length === 0) {
    return stats;
  }

  if (reprocessAll) {
    await db.contact.deleteMany({
      where: {
        supplierCompanyId,
        verificationState: { in: ["UNREVIEWED", "AUTO_APPROVED", "PENDING"] },
      },
    });
  }

  stats.totalProcessed = unreviewedClaims.length;

  const canonicalFacts: CanonicalClaimFact[] = consolidateExtractedClaims(unreviewedClaims);
  stats.uniqueCanonicalFacts = canonicalFacts.length;
  stats.collapsedDuplicates = unreviewedClaims.length - canonicalFacts.length;

  for (const fact of canonicalFacts) {
    const firstClaim = fact.supportingClaims[0];
    if (!firstClaim) continue;
    const supplierName = firstClaim.supplierCompany?.canonicalName || "Supplier";
    const supplierDomain = firstClaim.supplierCompany?.normalizedDomain || undefined;

    const combinedEvidence = fact.supportingClaims
      .map((c) => c.evidenceText)
      .filter(Boolean)
      .join(" | ");

    const bestPageType =
      fact.supportingClaims.find((c) => c.sourceDocument?.pageType === "SERVICES" || c.sourceDocument?.pageType === "CAPABILITIES")
        ?.sourceDocument?.pageType || firstClaim.sourceDocument?.pageType;

    const surroundingContext = firstClaim.sourceDocument?.extractedText
      ? firstClaim.sourceDocument.extractedText.slice(0, 500)
      : null;

    let validationResult;
    if (fact.hasContradictions) {
      validationResult = {
        decision: "HUMAN_REVIEW" as const,
        confidence: 0.0,
        risk: "HIGH" as const,
        reason: fact.contradictionReason || "Contradictory evidence detected across source pages",
        evidenceSupported: true,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:CONTRADICTION_DETECTOR",
      };
    } else {
      validationResult = await defaultClaimValidator.validateClaim({
        claimId: firstClaim.id,
        supplierCompanyId,
        supplierName,
        supplierDomain,
        claimType: fact.claimType,
        rawValue: fact.rawValue,
        normalizedValue: fact.normalizedValue,
        extractionMethod: fact.extractionMethods[0] || firstClaim.extractionMethod,
        extractionConfidence: fact.strongestConfidence,
        pageType: bestPageType,
        evidenceText: combinedEvidence || firstClaim.evidenceText || "",
        surroundingContext,
      });
    }

    // Check if there is a prior human review decision for this supplier & canonical fact
    const existingHumanReview = await db.extractedClaim.findFirst({
      where: {
        supplierCompanyId,
        claimType: fact.claimType,
        normalizedValue: fact.normalizedValue,
        OR: [
          { reviewedByUserId: { not: null } },
          { reviewState: { in: ["HUMAN_APPROVED", "HUMAN_REJECTED", "VERIFIED", "REJECTED"] } }
        ]
      }
    });

    let targetState = "HUMAN_REVIEW";
    let decisionToApply: string | null | undefined = validationResult.decision;
    let riskToApply: string | null | undefined = validationResult.risk;
    let reasonToApply: string | null | undefined = validationResult.reason;
    let confidenceToApply: number | null | undefined = validationResult.confidence;
    let actorToApply: string | null | undefined = validationResult.validatorActor;
    let reviewerUserIdToApply: string | null = null;
    let reviewedAtToApply: Date | null = null;

    if (existingHumanReview) {
      // Inherit existing human review decision
      targetState = existingHumanReview.reviewState;
      decisionToApply = existingHumanReview.validationDecision || validationResult.decision;
      riskToApply = existingHumanReview.validationRisk || validationResult.risk;
      reasonToApply = existingHumanReview.validationReason || "Inherited prior human review decision";
      confidenceToApply = existingHumanReview.validationConfidence || 1.0;
      actorToApply = existingHumanReview.validationActor || "HUMAN_ADMIN";
      reviewerUserIdToApply = existingHumanReview.reviewedByUserId;
      reviewedAtToApply = existingHumanReview.reviewedAt;

      if (targetState === "HUMAN_APPROVED" || targetState === "VERIFIED") {
        stats.publishedCount++;
      }
    } else if (validationResult.decision === "APPROVE" && validationResult.risk === "LOW") {
      targetState = "AUTO_APPROVED";
      stats.autoApproved++;
    } else if (validationResult.decision === "REJECT" && validationResult.risk === "LOW") {
      targetState = "AUTO_REJECTED";
      stats.autoRejected++;
    } else {
      targetState = "HUMAN_REVIEW";
      stats.needsHumanReview++;
    }

    // Update ALL underlying ExtractedClaims for this canonical fact
    const supportingClaimIds = fact.supportingClaims.map((c) => c.id);
    await db.extractedClaim.updateMany({
      where: { id: { in: supportingClaimIds } },
      data: {
        reviewState: targetState as unknown as import("@prisma/client").VerificationStateEnum,
        validationDecision: decisionToApply,
        validationRisk: riskToApply,
        validationReason: reasonToApply,
        validationConfidence: confidenceToApply,
        validationActor: actorToApply,
        reviewedByUserId: reviewerUserIdToApply,
        reviewedAt: reviewedAtToApply,
      },
    });

    // Flow Auto-Approved Low-Risk Canonical Facts through Publishing Service
    if (targetState === "AUTO_APPROVED") {
      try {
        const publishRes = await approveClaim("SYSTEM_VALIDATOR", firstClaim.id);
        if (publishRes.success) {
          stats.publishedCount++;
        }
      } catch (pubErr) {
        logger.warn({ pubErr, factId: fact.canonicalId }, "Auto-publishing failed for low-risk canonical fact");
      }
    }
  }

  // Final Step: Apply deterministic RFQ contact selection layer for the supplier
  try {
    await applySupplierRfqContactSelection(supplierCompanyId);
  } catch (err) {
    logger.warn({ err, supplierCompanyId }, "RFQ contact selection layer execution warning");
  }

  logger.info({ supplierCompanyId, stats }, "Canonical batch claim validation completed for supplier");
  return stats;
}
