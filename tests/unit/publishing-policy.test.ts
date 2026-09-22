import { describe, it, expect } from "vitest";
import { approveClaim, publishSupplierProfile } from "@/lib/admin/publishing";

describe("Supplier Publication Policy Guards", () => {
  it("approves claim without auto-publishing supplier company profile", async () => {
    const result = await approveClaim("SYSTEM_VALIDATOR", "claim_cap_test_1", {
      claimType: "CAPABILITY",
      normalizedValue: "cnc-machining",
    });

    expect(result.success).toBe(true);
    expect(result.publishedType).toBe("CAPABILITY");
  });

  it("supports explicit admin supplier profile publication via publishSupplierProfile", async () => {
    const result = await publishSupplierProfile("usr_admin_1", "supp_company_test_123");
    expect(result.success).toBe(true);
  });
});
