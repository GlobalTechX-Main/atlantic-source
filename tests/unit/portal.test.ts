import { describe, it, expect } from "vitest";
import {
  updateSupplierProfile,
  addSupplierCapability,
  submitSupplierCertification,
  manageSupplierMembers,
} from "@/lib/supplier/portal";
import { UserSession } from "@/lib/auth/session";

describe("Supplier Portal & Profile Management Engine", () => {
  const supplierAUser: UserSession = {
    id: "usr_supp_a",
    email: "admin@suppliera.ca",
    isPlatformAdmin: false,
    supplierMemberships: [
      { supplierCompanyId: "comp_supp_a", role: "SUPPLIER_ADMIN" },
    ],
    buyerMemberships: [],
  };

  const supplierAMemberUser: UserSession = {
    id: "usr_supp_a_member",
    email: "worker@suppliera.ca",
    isPlatformAdmin: false,
    supplierMemberships: [
      { supplierCompanyId: "comp_supp_a", role: "SUPPLIER_MEMBER" },
    ],
    buyerMemberships: [],
  };

  it("prevents Supplier A from editing Supplier B profile (Cross-supplier isolation)", async () => {
    await expect(
      updateSupplierProfile(supplierAUser, "comp_supp_b", {
        description: "Malicious update attempt",
      })
    ).rejects.toThrow("Not authorized to edit this supplier profile");
  });

  it("labels supplier-added capability as SUPPLIER_PROVIDED", async () => {
    const res = await addSupplierCapability(supplierAUser, "comp_supp_a", {
      capabilityId: "cap_pipe_fab",
    });

    expect(res.success).toBe(true);
    expect(res.id).toBeDefined();
  });

  it("CRITICAL RULE: Prohibits supplier from promoting itself to AtlanticSource VERIFIED", async () => {
    await expect(
      addSupplierCapability(
        supplierAUser,
        "comp_supp_a",
        { capabilityId: "cap_welding" },
        { provenanceType: "VERIFIED", verificationState: "VERIFIED" }
      )
    ).rejects.toThrow("Suppliers cannot promote capabilities or profiles to AtlanticSource Verified state.");

    await expect(
      submitSupplierCertification(
        supplierAUser,
        "comp_supp_a",
        { certificationId: "cwb-w47-1" },
        { provenanceType: "VERIFIED", verificationState: "VERIFIED" }
      )
    ).rejects.toThrow("Suppliers cannot promote certifications to AtlanticSource Verified state.");
  });

  it("enforces SUPPLIER_ADMIN requirement for managing team members", async () => {
    // SUPPLIER_MEMBER attempt: fails
    await expect(
      manageSupplierMembers(
        supplierAMemberUser,
        "comp_supp_a",
        "usr_new_worker",
        "SUPPLIER_MEMBER" as any
      )
    ).rejects.toThrow("Supplier Admin privileges required");

    // SUPPLIER_ADMIN attempt: succeeds
    const res = await manageSupplierMembers(
      supplierAUser,
      "comp_supp_a",
      "usr_new_worker",
      "SUPPLIER_MEMBER" as any
    );
    expect(res.success).toBe(true);
  });
});
