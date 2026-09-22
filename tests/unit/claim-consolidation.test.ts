import { describe, it, expect } from "vitest";
import { consolidateExtractedClaims, normalizeCertificationValue, normalizeContactValue } from "@/lib/validation/consolidation";

describe("Canonical Claim Consolidation Layer", () => {
  // 1. Same capability on multiple pages -> One canonical fact
  it("1. Consolidates same capability from multiple pages into one canonical fact", () => {
    const claims = [
      {
        id: "claim_1",
        supplierCompanyId: "supp_1",
        claimType: "CAPABILITY",
        rawValue: "Welding",
        normalizedValue: "welding",
        evidenceText: "Custom welding services available.",
        confidence: 0.9,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/services",
      },
      {
        id: "claim_2",
        supplierCompanyId: "supp_1",
        claimType: "CAPABILITY",
        rawValue: "Welding",
        normalizedValue: "welding",
        evidenceText: "Our shop offers high quality welding.",
        confidence: 0.85,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/about",
      },
      {
        id: "claim_3",
        supplierCompanyId: "supp_1",
        claimType: "CAPABILITY",
        rawValue: "Welding",
        normalizedValue: "welding",
        evidenceText: "Welding shop expanded.",
        confidence: 0.8,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/capabilities",
      },
    ];

    const canonicalFacts = consolidateExtractedClaims(claims);
    expect(canonicalFacts.length).toBe(1);
    expect(canonicalFacts[0]!.normalizedValue).toBe("welding");
    expect(canonicalFacts[0]!.supportingClaims.length).toBe(3);
    expect(canonicalFacts[0]!.supportingSourcesCount).toBe(3);
    expect(canonicalFacts[0]!.strongestConfidence).toBe(0.9);
    expect(canonicalFacts[0]!.sourceUrls).toEqual([
      "https://example.com/services",
      "https://example.com/about",
      "https://example.com/capabilities",
    ]);
  });

  // 2. Conservative CWB certification normalization and regression tests
  it("2. Conservatively normalizes CWB certification variants and preserves distinct categories", () => {
    // Explicit W47.1 -> cwb-w47-1
    expect(normalizeCertificationValue("CWB W47.1").slug).toBe("cwb-w47-1");
    expect(normalizeCertificationValue("W47.1").slug).toBe("cwb-w47-1");

    // Generic CWB certified -> cwb-certified
    expect(normalizeCertificationValue("CWB certified").slug).toBe("cwb-certified");
    expect(normalizeCertificationValue("Certified by CWB").slug).toBe("cwb-certified");

    // Canadian Welding Bureau organization mention alone -> cwb-organization (does NOT imply certification)
    expect(normalizeCertificationValue("Canadian Welding Bureau").slug).toBe("cwb-organization");

    // Ambiguous CWB mention -> cwb-ambiguous
    expect(normalizeCertificationValue("CWB").slug).toBe("cwb-ambiguous");
    expect(normalizeCertificationValue("CWB member").slug).toBe("cwb-ambiguous");

    const claims = [
      {
        id: "c1",
        supplierCompanyId: "supp_1",
        claimType: "CERTIFICATION",
        rawValue: "CWB W47.1",
        normalizedValue: "cwb-w47-1",
        evidenceText: "CWB W47.1 certified welders.",
        confidence: 0.85,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/page1",
      },
      {
        id: "c2",
        supplierCompanyId: "supp_1",
        claimType: "CERTIFICATION",
        rawValue: "W47.1",
        normalizedValue: "w47.1",
        evidenceText: "W47.1 shop certification.",
        confidence: 0.8,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/page2",
      },
      {
        id: "c3",
        supplierCompanyId: "supp_1",
        claimType: "CERTIFICATION",
        rawValue: "CWB certified",
        normalizedValue: "cwb-certified",
        evidenceText: "Fully CWB certified.",
        confidence: 0.75,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/page3",
      },
      {
        id: "c4",
        supplierCompanyId: "supp_1",
        claimType: "CERTIFICATION",
        rawValue: "Canadian Welding Bureau",
        normalizedValue: "cwb-organization",
        evidenceText: "Registered with Canadian Welding Bureau.",
        confidence: 0.6,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/page4",
      },
      {
        id: "c5",
        supplierCompanyId: "supp_1",
        claimType: "CERTIFICATION",
        rawValue: "CWB",
        normalizedValue: "cwb-ambiguous",
        evidenceText: "Mention of CWB.",
        confidence: 0.5,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/page5",
      },
    ];

    const canonicalFacts = consolidateExtractedClaims(claims);
    expect(canonicalFacts.length).toBe(4);

    const w47Fact = canonicalFacts.find((f) => f.normalizedValue === "cwb-w47-1");
    expect(w47Fact).toBeDefined();
    expect(w47Fact!.supportingClaims.length).toBe(2);

    const genericFact = canonicalFacts.find((f) => f.normalizedValue === "cwb-certified");
    expect(genericFact).toBeDefined();
    expect(genericFact!.rawValue).toBe("CWB Certified (Standard Unspecified)");

    const orgFact = canonicalFacts.find((f) => f.normalizedValue === "cwb-organization");
    expect(orgFact).toBeDefined();
    expect(orgFact!.rawValue).toBe("Canadian Welding Bureau (Organization Mention)");

    const ambiguousFact = canonicalFacts.find((f) => f.normalizedValue === "cwb-ambiguous");
    expect(ambiguousFact).toBeDefined();
    expect(ambiguousFact!.rawValue).toBe("CWB (Ambiguous Mention)");
  });

  // 3. Same email repeated on multiple pages -> One contact fact
  it("3. Consolidates repeated email mentions across pages into one contact fact", () => {
    const claims = [
      {
        id: "e1",
        supplierCompanyId: "supp_1",
        claimType: "CONTACT",
        rawValue: "%20info@example.ca",
        normalizedValue: "info@example.ca",
        evidenceText: "mailto:info@example.ca",
        confidence: 0.95,
        extractionMethod: "CONTACT_PARSER",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/contact",
      },
      {
        id: "e2",
        supplierCompanyId: "supp_1",
        claimType: "CONTACT",
        rawValue: "info@example.ca",
        normalizedValue: "info@example.ca",
        evidenceText: "Surrounding text: Email info@example.ca",
        confidence: 0.9,
        extractionMethod: "CONTACT_PARSER",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/about",
      },
    ];

    const canonicalFacts = consolidateExtractedClaims(claims);
    expect(canonicalFacts.length).toBe(1);
    expect(canonicalFacts[0]!.normalizedValue).toBe("info@example.ca");
    expect(canonicalFacts[0]!.supportingClaims.length).toBe(2);
  });

  // 4. Phone formatting variants -> One phone fact
  it("4. Consolidates phone formatting variants into one canonical phone fact", () => {
    expect(normalizeContactValue("(506) 647-9915")).toBe("5066479915");
    expect(normalizeContactValue("506-647-9915")).toBe("5066479915");
    expect(normalizeContactValue("5066479915")).toBe("5066479915");
    expect(normalizeContactValue("1-506-647-9915")).toBe("5066479915");

    const claims = [
      {
        id: "p1",
        supplierCompanyId: "supp_1",
        claimType: "CONTACT",
        rawValue: "(506) 647-9915",
        normalizedValue: "(506) 647-9915",
        evidenceText: "Phone: (506) 647-9915",
        confidence: 0.95,
        extractionMethod: "CONTACT_PARSER",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/contact",
      },
      {
        id: "p2",
        supplierCompanyId: "supp_1",
        claimType: "CONTACT",
        rawValue: "506-647-9915",
        normalizedValue: "506-647-9915",
        evidenceText: "Call 506-647-9915",
        confidence: 0.85,
        extractionMethod: "CONTACT_PARSER",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/footer",
      },
    ];

    const canonicalFacts = consolidateExtractedClaims(claims);
    expect(canonicalFacts.length).toBe(1);
    expect(canonicalFacts[0]!.normalizedValue).toBe("5066479915");
    expect(canonicalFacts[0]!.rawValue).toBe("(506) 647-9915");
    expect(canonicalFacts[0]!.supportingClaims.length).toBe(2);
  });

  // 5. Contradictory claims -> Marked with contradiction flag
  it("5. Flags contradictory claim evidence across source pages", () => {
    const claims = [
      {
        id: "c1",
        supplierCompanyId: "supp_1",
        claimType: "CAPABILITY",
        rawValue: "Underwater Welding",
        normalizedValue: "underwater-welding",
        evidenceText: "We specialize in commercial underwater welding.",
        confidence: 0.85,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/page1",
      },
      {
        id: "c2",
        supplierCompanyId: "supp_1",
        claimType: "CAPABILITY",
        rawValue: "Underwater Welding",
        normalizedValue: "underwater-welding",
        evidenceText: "Please note: We do NOT offer underwater welding at this time.",
        confidence: 0.95,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/faq",
      },
    ];

    const canonicalFacts = consolidateExtractedClaims(claims);
    expect(canonicalFacts.length).toBe(1);
    expect(canonicalFacts[0]!.hasContradictions).toBe(true);
    expect(canonicalFacts[0]!.contradictionReason).toContain("Contradictory evidence detected");
  });

  // 6. Genuinely different facts MUST NOT be merged
  it("6. Does NOT merge genuinely different facts", () => {
    const claims = [
      {
        id: "diff1",
        supplierCompanyId: "supp_1",
        claimType: "CAPABILITY",
        rawValue: "Welding",
        normalizedValue: "welding",
        evidenceText: "Welding services",
        confidence: 0.9,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/services",
      },
      {
        id: "diff2",
        supplierCompanyId: "supp_1",
        claimType: "CAPABILITY",
        rawValue: "Laser Cutting",
        normalizedValue: "laser-cutting",
        evidenceText: "Laser cutting services",
        confidence: 0.9,
        extractionMethod: "TAXONOMY_EXACT",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/services",
      },
      {
        id: "diff3",
        supplierCompanyId: "supp_1",
        claimType: "CONTACT",
        rawValue: "sales@example.com",
        normalizedValue: "sales@example.com",
        evidenceText: "sales@example.com",
        confidence: 0.95,
        extractionMethod: "CONTACT_PARSER",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/contact",
      },
      {
        id: "diff4",
        supplierCompanyId: "supp_1",
        claimType: "CONTACT",
        rawValue: "support@example.com",
        normalizedValue: "support@example.com",
        evidenceText: "support@example.com",
        confidence: 0.95,
        extractionMethod: "CONTACT_PARSER",
        reviewState: "UNREVIEWED",
        sourceUrl: "https://example.com/contact",
      },
    ];

    const canonicalFacts = consolidateExtractedClaims(claims);
    expect(canonicalFacts.length).toBe(4);
  });
});
