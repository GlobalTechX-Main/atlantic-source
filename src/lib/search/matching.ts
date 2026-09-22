export type MatchItemStatus = "SATISFIED" | "PARTIALLY_SATISFIED" | "NOT_SATISFIED" | "UNKNOWN";

export interface MatchBreakdownItem {
  item: string;
  status: MatchItemStatus;
  label: string;
  note?: string;
}

export type CertRequirementStrictness = "VERIFIED" | "ALLOW_DISCOVERED";

export interface BuyerMatchCriteria {
  requiredCapabilityIds?: string[];
  preferredCapabilityIds?: string[];
  requiredCertificationIds?: string[];
  certStrictness?: CertRequirementStrictness;
  preferredIndustryIds?: string[];
  targetCity?: string | null;
  targetProvince?: string | null;
}

export interface SupplierEntityForMatch {
  id: string;
  canonicalName: string;
  claimStatus: string;
  verificationStatus: string;
  capabilities: Array<{
    capabilityId: string;
    slug?: string;
    canonicalName?: string;
    verificationState: string;
    provenanceType: string;
    published: boolean;
  }>;
  certifications: Array<{
    certificationId: string;
    slug?: string;
    canonicalName?: string;
    verificationState: string;
    provenanceType: string;
    published: boolean;
  }>;
  industries: Array<{
    industryId: string;
    slug?: string;
    canonicalName?: string;
    published: boolean;
  }>;
  serviceRegions: Array<{
    serviceRegionId: string;
    slug?: string;
    name?: string;
  }>;
  locations: Array<{
    city: string;
    province: string;
  }>;
  contactConfidenceRating?: "HIGH" | "MEDIUM" | "LOW";
}

export interface MatchEngineResult {
  scorePercentage: number;
  isEligible: boolean;
  breakdown: MatchBreakdownItem[];
}

export function calculateSupplierMatch(
  supplier: SupplierEntityForMatch,
  criteria: BuyerMatchCriteria
): MatchEngineResult {
  const breakdown: MatchBreakdownItem[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;
  let isEligible = true;

  const reqCaps = criteria.requiredCapabilityIds || [];
  const prefCaps = criteria.preferredCapabilityIds || [];
  const reqCerts = criteria.requiredCertificationIds || [];
  const certStrictness: CertRequirementStrictness = criteria.certStrictness || "VERIFIED";
  const prefInds = criteria.preferredIndustryIds || [];
  const targetCity = criteria.targetCity?.trim().toLowerCase();
  const targetProvince = criteria.targetProvince?.trim().toLowerCase();

  // 1. Required Capabilities Match
  if (reqCaps.length > 0) {
    const poolWeight = 35;
    const weightPerCap = poolWeight / reqCaps.length;
    maxPossibleScore += poolWeight;

    for (const reqCapId of reqCaps) {
      const matchedCap = supplier.capabilities.find(
        (c) => c.capabilityId === reqCapId || c.slug === reqCapId
      );

      if (matchedCap && matchedCap.published) {
        totalScore += weightPerCap;
        breakdown.push({
          item: `Capability: ${matchedCap.canonicalName || reqCapId}`,
          status: "SATISFIED",
          label: `✓ ${matchedCap.canonicalName || reqCapId}`,
        });
      } else {
        isEligible = false;
        breakdown.push({
          item: `Capability: ${reqCapId}`,
          status: "NOT_SATISFIED",
          label: `✗ Missing required capability: ${reqCapId}`,
          note: "Supplier profile does not list this capability",
        });
      }
    }
  }

  // 2. Required Certifications Match (Strict Provenance Rule)
  if (reqCerts.length > 0) {
    const poolWeight = 25;
    const weightPerCert = poolWeight / reqCerts.length;
    maxPossibleScore += poolWeight;

    for (const reqCertId of reqCerts) {
      const matchedCert = supplier.certifications.find(
        (c) => c.certificationId === reqCertId || c.slug === reqCertId
      );

      if (!matchedCert) {
        isEligible = false;
        breakdown.push({
          item: `Certification: ${reqCertId}`,
          status: "NOT_SATISFIED",
          label: `✗ Missing required certification: ${reqCertId}`,
          note: "Supplier profile does not possess this certification",
        });
      } else {
        const isVerifiedCert =
          matchedCert.verificationState === "VERIFIED" ||
          matchedCert.provenanceType === "VERIFIED";

        if (isVerifiedCert) {
          totalScore += weightPerCert;
          breakdown.push({
            item: `Certification: ${matchedCert.canonicalName || reqCertId}`,
            status: "SATISFIED",
            label: `✓ Verified ${matchedCert.canonicalName || reqCertId}`,
          });
        } else {
          // Publicly discovered website mention or supplier provided unverified
          if (certStrictness === "VERIFIED") {
            isEligible = false;
            breakdown.push({
              item: `Certification: ${matchedCert.canonicalName || reqCertId}`,
              status: "NOT_SATISFIED",
              label: `⚠ ${matchedCert.canonicalName || reqCertId} publicly mentioned but not independently verified`,
              note: "Buyer requires independently verified certification. Website evidence alone is insufficient.",
            });
          } else {
            // Buyer allows discovered evidence
            totalScore += weightPerCert * 0.5;
            breakdown.push({
              item: `Certification: ${matchedCert.canonicalName || reqCertId}`,
              status: "PARTIALLY_SATISFIED",
              label: `⚠ ${matchedCert.canonicalName || reqCertId} website mention accepted (Unverified)`,
              note: "Broadened requirement mode allowed unverified public website claim.",
            });
          }
        }
      }
    }
  }

  // 3. Location & Service Region Proximity
  if (targetCity || targetProvince) {
    const poolWeight = 20;
    maxPossibleScore += poolWeight;

    const cityMatch = targetCity
      ? supplier.locations.some((l) => l.city.toLowerCase() === targetCity) ||
        supplier.serviceRegions.some(
          (r) => r.slug === targetCity || r.name?.toLowerCase() === targetCity
        )
      : false;

    const provinceMatch = targetProvince
      ? supplier.locations.some((l) => l.province.toLowerCase() === targetProvince) ||
        supplier.serviceRegions.some(
          (r) => r.slug === targetProvince || r.name?.toLowerCase() === targetProvince
        )
      : false;

    if (cityMatch) {
      totalScore += poolWeight;
      const displayCity = criteria.targetCity || targetCity;
      breakdown.push({
        item: `Location: ${displayCity}`,
        status: "SATISFIED",
        label: `✓ Serves ${displayCity}`,
      });
    } else if (provinceMatch) {
      totalScore += poolWeight * 0.7;
      const displayProv = criteria.targetProvince || targetProvince;
      breakdown.push({
        item: `Location: ${displayProv}`,
        status: "PARTIALLY_SATISFIED",
        label: `✓ Serves ${displayProv} region`,
      });
    } else {
      breakdown.push({
        item: `Location: Proximity`,
        status: "UNKNOWN",
        label: `⚠ Location outside target area`,
      });
    }
  }

  // 4. Preferred Capabilities
  if (prefCaps.length > 0) {
    const poolWeight = 10;
    const weightPerCap = poolWeight / prefCaps.length;
    maxPossibleScore += poolWeight;

    for (const prefCapId of prefCaps) {
      const matchedCap = supplier.capabilities.find(
        (c) => c.capabilityId === prefCapId || c.slug === prefCapId
      );

      if (matchedCap && matchedCap.published) {
        totalScore += weightPerCap;
        breakdown.push({
          item: `Preferred Capability: ${matchedCap.canonicalName || prefCapId}`,
          status: "SATISFIED",
          label: `✓ Preferred: ${matchedCap.canonicalName || prefCapId}`,
        });
      }
    }
  }

  // 5. Preferred Industries
  if (prefInds.length > 0) {
    const poolWeight = 5;
    const weightPerInd = poolWeight / prefInds.length;
    maxPossibleScore += poolWeight;

    for (const prefIndId of prefInds) {
      const matchedInd = supplier.industries.find(
        (i) => i.industryId === prefIndId || i.slug === prefIndId
      );

      if (matchedInd && matchedInd.published) {
        totalScore += weightPerInd;
        breakdown.push({
          item: `Industry: ${matchedInd.canonicalName || prefIndId}`,
          status: "SATISFIED",
          label: `✓ Industry: ${matchedInd.canonicalName || prefIndId}`,
        });
      }
    }
  }

  // 6. Contact Confidence & Trust Signal Additions
  const trustWeight = 5;
  maxPossibleScore += trustWeight;
  if (supplier.contactConfidenceRating === "HIGH") {
    totalScore += trustWeight;
  } else if (supplier.contactConfidenceRating === "MEDIUM") {
    totalScore += trustWeight * 0.6;
  }

  const finalPercentage =
    maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 100;

  return {
    scorePercentage: Math.min(100, Math.max(0, finalPercentage)),
    isEligible,
    breakdown,
  };
}
