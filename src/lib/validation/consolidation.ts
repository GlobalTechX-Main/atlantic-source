export interface SupportingClaimItem {
  id: string;
  supplierCompanyId: string;
  claimType: string;
  rawValue: string;
  normalizedValue: string | null;
  evidenceText: string | null;
  confidence: number;
  extractionMethod: string;
  reviewState: string;
  validationDecision?: string | null;
  validationRisk?: string | null;
  validationReason?: string | null;
  validationConfidence?: number | null;
  validationActor?: string | null;
  sourceDocumentId?: string | null;
  sourceUrl?: string | null;
  pageType?: string | null;
  createdAt?: Date;
  supplierCompany?: { canonicalName: string; normalizedDomain?: string | null };
  sourceDocument?: { sourceUrl: string; pageType?: string | null; extractedText?: string | null } | null;
}

export interface CanonicalClaimFact {
  canonicalId: string; // Unique key: supplierCompanyId:claimType:normalizedValue
  supplierCompanyId: string;
  supplierName: string;
  claimType: string;
  rawValue: string;
  normalizedValue: string;
  supportingClaims: SupportingClaimItem[];
  supportingSourcesCount: number; // Count of unique source URLs
  sourceUrls: string[];
  strongestConfidence: number;
  extractionMethods: string[];
  hasContradictions: boolean;
  contradictionReason?: string;

  // Validation State:
  reviewState: string; // AUTO_APPROVED, AUTO_REJECTED, HUMAN_REVIEW, UNREVIEWED, APPROVED
  validationDecision?: string | null;
  validationRisk?: string | null;
  validationReason?: string | null;
  validationConfidence?: number | null;
  validationActor?: string | null;
}

export function normalizeCertificationValue(val: string): { slug: string; canonicalName: string } {
  const lower = val.toLowerCase().trim();

  // 1. Explicit CWB W47.1 or explicit W47.1
  if (lower.includes("w47.1") || lower.includes("w47-1") || lower.includes("w47 1")) {
    return { slug: "cwb-w47-1", canonicalName: "CWB W47.1 Certification" };
  }

  // 2. Generic CWB certified / certification (without explicit W47.1)
  if (
    (lower.includes("cwb") && (lower.includes("certified") || lower.includes("certification"))) ||
    lower.includes("certified by cwb")
  ) {
    return { slug: "cwb-certified", canonicalName: "CWB Certified (Standard Unspecified)" };
  }

  // 3. Canadian Welding Bureau organization mention alone (MUST NOT imply certification)
  if (lower.includes("canadian welding bureau") && !lower.includes("certified") && !lower.includes("certification")) {
    return { slug: "cwb-organization", canonicalName: "Canadian Welding Bureau (Organization Mention)" };
  }

  // 4. Ambiguous CWB mention
  if (lower === "cwb" || lower.startsWith("cwb ") || lower.includes("cwb member") || lower.includes("cwb registered")) {
    return { slug: "cwb-ambiguous", canonicalName: "CWB (Ambiguous Mention)" };
  }

  // ISO 9001 variants
  if (lower.includes("iso 9001") || lower.includes("iso9001") || lower.includes("iso 9001:2015")) {
    return { slug: "iso-9001", canonicalName: "ISO 9001 Quality Management" };
  }

  // COR Safety variants
  if (
    lower.includes("cor safety") ||
    lower.includes("cor certified") ||
    lower.includes("cor-safety") ||
    lower.includes("certificate of recognition")
  ) {
    return { slug: "cor-safety", canonicalName: "COR Safety Certification" };
  }

  // ASME variants
  if (lower.includes("asme")) {
    return { slug: "asme-pressure-vessel", canonicalName: "ASME Pressure Piping / Vessel" };
  }

  const slug = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { slug: slug || lower, canonicalName: val };
}

export function normalizeContactValue(raw: string, normalized?: string | null): string {
  let target = (normalized || raw).trim();
  try {
    target = decodeURIComponent(target);
  } catch {
    // Ignore decode error
  }

  if (target.includes("@") || raw.includes("@")) {
    let cleaned = target.replace(/^mailto:/i, "").replace(/^%20/i, "").trim().toLowerCase();
    cleaned = cleaned.replace(/^(email|e-mail|contact|mail|address|to)[:\s-]*/i, "");
    cleaned = cleaned.replace(/\.(com|ca|org|net|co|io|biz|info|us)(phone|tel|address|fax|call|mobile|contact).*$/i, ".$1");
    return cleaned;
  }

  const digits = target.replace(/\D/g, "");
  if (digits.length === 10) {
    return digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return target.trim().toLowerCase();
}

export function getCanonicalFactKey(
  claimType: string,
  rawValue: string,
  normalizedValue?: string | null
): { slug: string; canonicalName: string } {
  if (claimType === "CERTIFICATION") {
    return normalizeCertificationValue(rawValue || normalizedValue || "");
  }

  if (claimType === "CONTACT") {
    const key = normalizeContactValue(rawValue, normalizedValue);
    let displayName = key;
    if (/^\d{10}$/.test(key)) {
      displayName = `(${key.slice(0, 3)}) ${key.slice(3, 6)}-${key.slice(6)}`;
    }
    return { slug: key, canonicalName: displayName };
  }

  if (claimType === "LOCATION") {
    const normPostal = (normalizedValue || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const streetSlug = (rawValue || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = normPostal && streetSlug ? `${normPostal}-${streetSlug}` : normPostal || streetSlug || "unknown-location";
    return { slug, canonicalName: rawValue };
  }

  const rawOrNorm = (normalizedValue || rawValue).trim();
  const slug = rawOrNorm
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return { slug: slug || "unknown", canonicalName: rawValue };
}

const NEGATION_PATTERNS = [
  /do\s+not\s+(offer|provide|perform|manufacture|do)/i,
  /don'?t\s+(offer|provide|perform|manufacture|do)/i,
  /no\s+longer\s+(offer|provide|perform|manufacture|do)/i,
  /not\s+available/i,
  /we\s+do\s+not\s+do/i,
  /excluded\s+from\s+scope/i,
];

/**
 * Consolidates individual ExtractedClaims into unified CanonicalClaimFacts.
 */
export function consolidateExtractedClaims(claims: SupportingClaimItem[]): CanonicalClaimFact[] {
  const groups = new Map<string, SupportingClaimItem[]>();

  for (const claim of claims) {
    const { slug } = getCanonicalFactKey(claim.claimType, claim.rawValue, claim.normalizedValue);
    const key = `${claim.supplierCompanyId}:${claim.claimType}:${slug}`;
    const existing = groups.get(key) || [];
    existing.push(claim);
    groups.set(key, existing);
  }

  const canonicalFacts: CanonicalClaimFact[] = [];

  for (const [key, supportingClaims] of groups.entries()) {
    const first = supportingClaims[0];
    if (!first) continue;
    const { slug, canonicalName } = getCanonicalFactKey(first.claimType, first.rawValue, first.normalizedValue);

    // Extract unique source URLs
    const sourceUrls = Array.from(
      new Set(
        supportingClaims
          .map((c) => c.sourceUrl || c.sourceDocument?.sourceUrl)
          .filter((url): url is string => Boolean(url))
      )
    );

    // Extract unique extraction methods
    const extractionMethods = Array.from(new Set(supportingClaims.map((c) => c.extractionMethod)));

    // Calculate strongest confidence
    const strongestConfidence = Math.max(...supportingClaims.map((c) => c.confidence));

    // Check for evidence contradictions across supporting claims
    let hasNegation = false;
    let hasAffirmative = false;

    for (const c of supportingClaims) {
      const text = `${c.evidenceText || ""} ${c.sourceDocument?.extractedText || ""}`;
      const isNegated = NEGATION_PATTERNS.some((p) => p.test(text));
      if (isNegated) {
        hasNegation = true;
      } else {
        hasAffirmative = true;
      }
    }

    const hasContradictions = hasNegation && hasAffirmative;
    const contradictionReason = hasContradictions
      ? "Contradictory evidence detected across source pages (negated vs affirmative claim mentions)"
      : undefined;

    // Determine initial consolidated review state (use most advanced state if available)
    let reviewState = "UNREVIEWED";
    if (supportingClaims.some((c) => c.reviewState === "APPROVED" || c.reviewState === "VERIFIED")) {
      reviewState = "APPROVED";
    } else if (supportingClaims.some((c) => c.reviewState === "AUTO_APPROVED")) {
      reviewState = "AUTO_APPROVED";
    } else if (supportingClaims.some((c) => c.reviewState === "AUTO_REJECTED")) {
      reviewState = "AUTO_REJECTED";
    } else if (supportingClaims.some((c) => c.reviewState === "HUMAN_REVIEW")) {
      reviewState = "HUMAN_REVIEW";
    }

    const supplierName = first.supplierCompany?.canonicalName || "Supplier";

    canonicalFacts.push({
      canonicalId: key,
      supplierCompanyId: first.supplierCompanyId,
      supplierName,
      claimType: first.claimType,
      rawValue: canonicalName,
      normalizedValue: slug,
      supportingClaims,
      supportingSourcesCount: sourceUrls.length || 1,
      sourceUrls,
      strongestConfidence,
      extractionMethods,
      hasContradictions,
      contradictionReason,
      reviewState,
      validationDecision: first.validationDecision,
      validationRisk: first.validationRisk,
      validationReason: first.validationReason,
      validationConfidence: first.validationConfidence,
      validationActor: first.validationActor,
    });
  }

  return canonicalFacts;
}
