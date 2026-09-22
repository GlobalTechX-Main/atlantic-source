import { describe, it, expect } from "vitest";
import { calculateSupplierMatch, SupplierEntityForMatch } from "@/lib/search/matching";

describe("Deterministic Supplier MatchEngine", () => {
  const baseSupplier: SupplierEntityForMatch = {
    id: "comp_saint_john_steel",
    canonicalName: "Saint John Industrial Steel & Welding Ltd.",
    claimStatus: "VERIFIED",
    verificationStatus: "VERIFIED",
    capabilities: [
      {
        capabilityId: "cap_struct",
        slug: "structural-steel-fabrication",
        canonicalName: "Structural Steel Fabrication",
        verificationState: "VERIFIED",
        provenanceType: "VERIFIED",
        published: true,
      },
      {
        capabilityId: "cap_stainless",
        slug: "stainless-steel-fabrication",
        canonicalName: "Stainless Steel Fabrication",
        verificationState: "VERIFIED",
        provenanceType: "VERIFIED",
        published: true,
      },
    ],
    certifications: [
      {
        certificationId: "cert_cwb",
        slug: "cwb-w47-1",
        canonicalName: "CWB W47.1 Certification",
        verificationState: "UNREVIEWED",
        provenanceType: "PUBLICLY_DISCOVERED",
        published: true,
      },
    ],
    industries: [
      {
        industryId: "ind_mfg",
        slug: "industrial-manufacturing",
        canonicalName: "Industrial Manufacturing",
        published: true,
      },
    ],
    serviceRegions: [
      { serviceRegionId: "reg_sj", slug: "saint-john", name: "Saint John" },
    ],
    locations: [{ city: "Saint John", province: "NB" }],
    contactConfidenceRating: "HIGH",
  };

  it("satisfies required capabilities when present and published", () => {
    const res = calculateSupplierMatch(baseSupplier, {
      requiredCapabilityIds: ["structural-steel-fabrication"],
    });

    expect(res.isEligible).toBe(true);
    expect(res.scorePercentage).toBeGreaterThan(0);
    const item = res.breakdown.find((b) => b.item.includes("Structural Steel Fabrication"));
    expect(item?.status).toBe("SATISFIED");
  });

  it("marks missing required capability as NOT_SATISFIED and makes supplier ineligible", () => {
    const res = calculateSupplierMatch(baseSupplier, {
      requiredCapabilityIds: ["electrical-contracting"],
    });

    expect(res.isEligible).toBe(false);
    const item = res.breakdown.find((b) => b.item.includes("electrical-contracting"));
    expect(item?.status).toBe("NOT_SATISFIED");
  });

  it("CRITICAL RULE: Rejects unverified website certification claim under strict VERIFIED mode", () => {
    const resStrict = calculateSupplierMatch(baseSupplier, {
      requiredCertificationIds: ["cwb-w47-1"],
      certStrictness: "VERIFIED",
    });

    expect(resStrict.isEligible).toBe(false);
    const certItem = resStrict.breakdown.find((b) => b.item.includes("CWB W47.1"));
    expect(certItem?.status).toBe("NOT_SATISFIED");
    expect(certItem?.label).toContain("publicly mentioned but not independently verified");
  });

  it("Allows discovered website certification claim under ALLOW_DISCOVERED mode", () => {
    const resBroadened = calculateSupplierMatch(baseSupplier, {
      requiredCertificationIds: ["cwb-w47-1"],
      certStrictness: "ALLOW_DISCOVERED",
    });

    expect(resBroadened.isEligible).toBe(true);
    const certItem = resBroadened.breakdown.find((b) => b.item.includes("CWB W47.1"));
    expect(certItem?.status).toBe("PARTIALLY_SATISFIED");
    expect(certItem?.label).toContain("website mention accepted");
  });

  it("scores location proximity correctly for city match", () => {
    const res = calculateSupplierMatch(baseSupplier, {
      targetCity: "Saint John",
    });

    const locItem = res.breakdown.find((b) => b.item.includes("Saint John"));
    expect(locItem?.status).toBe("SATISFIED");
  });
});
