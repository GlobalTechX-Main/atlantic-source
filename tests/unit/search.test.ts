import { describe, it, expect } from "vitest";
import { searchSuppliers } from "@/lib/search/engine";

describe("Public Supplier Search & Discovery Engine", () => {
  it("returns published suppliers matching keyword search query", async () => {
    const res = await searchSuppliers({ q: "Steel" });
    expect(res.suppliers.length).toBeGreaterThan(0);
    expect(res.suppliers[0]!.canonicalName).toContain("Steel");
  });

  it("filters suppliers by city geography", async () => {
    const res = await searchSuppliers({ city: "Saint John" });
    expect(res.suppliers.length).toBeGreaterThan(0);
    expect(res.suppliers[0]!.locations[0]!.city).toBe("Saint John");
  });

  it("filters suppliers by capability slug", async () => {
    const res = await searchSuppliers({ capabilities: ["machining"] });
    expect(res.suppliers.length).toBeGreaterThan(0);
    expect(res.suppliers[0]!.capabilities.some((c) => c.slug === "machining")).toBe(true);
  });

  it("does NOT display match score for keyword search alone", async () => {
    const res = await searchSuppliers({ q: "Steel" });
    expect(res.hasActiveStructuredMatching).toBe(false);
    expect(res.suppliers[0]!.matchResult).toBeUndefined();
  });

  it("attaches matchResult ONLY when structured matching criteria are provided", async () => {
    const res = await searchSuppliers({
      matchingCriteria: {
        requiredCapabilityIds: ["structural-steel-fabrication"],
        targetCity: "Saint John",
      },
    });

    expect(res.hasActiveStructuredMatching).toBe(true);
    expect(res.suppliers[0]!.matchResult).toBeDefined();
    expect(res.suppliers[0]!.matchResult?.scorePercentage).toBeGreaterThan(0);
  });

  it("prevents public data leakage (no raw ExtractedClaims or private keys exposed)", async () => {
    const res = await searchSuppliers({ q: "Steel" });
    const supplier = res.suppliers[0] as any;

    expect(supplier.extractedClaims).toBeUndefined();
    expect(supplier.crawlRuns).toBeUndefined();
    expect(supplier.sourceDocuments).toBeUndefined();
  });
});
