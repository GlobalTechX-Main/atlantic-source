import { describe, it, expect } from "vitest";
import {
  parseAtlanticAddress,
  locationRoleFromEvidence,
  isNotACompanyLocation,
  isPlaceholderAddress,
  metroTowns,
} from "@/lib/locations/address";

describe("parseAtlanticAddress", () => {
  it("reads city, province and postal code", () => {
    expect(parseAtlanticAddress("265 Industrial Ave, Moncton, NB E1C 4A1")).toEqual({
      city: "Moncton",
      province: "NB",
      postalCode: "E1C 4A1",
    });
  });

  it("uses the postal code for the province", () => {
    expect(parseAtlanticAddress("30 Thornhill Dr, Dartmouth B3B1S1").province).toBe("NS");
  });

  it("does not mistake St. John's for Saint John", () => {
    expect(parseAtlanticAddress("12 Water St, Saint John's, NL A1C 1A1").city).toBe("St. John's");
    expect(parseAtlanticAddress("100 Main St, Saint John, NB E2L 1A1").city).toBe("Saint John");
  });

  it("prefers the town written next to the province", () => {
    expect(parseAtlanticAddress("Moncton Industrial Park, 55 Rue Champlain, Dieppe, NB E1A 1N4").city).toBe("Dieppe");
  });

  it("falls back to the word before the province", () => {
    expect(parseAtlanticAddress("4 Mill Rd, Petitcodiac, NB E4Z 4K6").city).toBe("Petitcodiac");
  });
});

describe("location roles", () => {
  it("reads the role from evidence", () => {
    expect(locationRoleFromEvidence('Extracted address snippet: "x" (Role: BRANCH)')).toBe("BRANCH");
    expect(locationRoleFromEvidence("no role")).toBe("UNKNOWN");
  });

  it("skips project, service-area and out-of-region addresses", () => {
    expect(isNotACompanyLocation("PROJECT_OR_CLIENT_LOCATION")).toBe(true);
    expect(isNotACompanyLocation("OUT_OF_REGION")).toBe(true);
    expect(isNotACompanyLocation("HEADQUARTERS")).toBe(false);
  });

  it("recognises placeholder rows", () => {
    expect(isPlaceholderAddress("Moncton Location (Seeded)")).toBe(true);
    expect(isPlaceholderAddress("Moncton (listed city)")).toBe(true);
    expect(isPlaceholderAddress("265 Industrial Ave")).toBe(false);
  });
});

describe("metroTowns", () => {
  it("includes nearby towns for directory cities", () => {
    expect(metroTowns("moncton")).toContain("Dieppe");
    expect(metroTowns("Saint John")).toContain("Quispamsis");
    expect(metroTowns("Bathurst")).toEqual(["Bathurst"]);
  });
});
