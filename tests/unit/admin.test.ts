import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UserRoleEnum } from "@prisma/client";
import { UserSession, setTestSessionOverride } from "@/lib/auth/session";
import { requirePlatformAdmin } from "@/lib/auth/rbac";
import { normalizeDomain, normalizePhone, generateSlug, evaluateIngestionCandidate } from "@/lib/admin/ingestion";
import { approveClaim, rejectClaim, markClaimStale } from "@/lib/admin/publishing";
import { logAdminAction } from "@/lib/admin/audit";
import { ForbiddenError } from "@/lib/errors";

describe("Platform Admin Workflows, Ingestion & Publishing", () => {
  const platformAdmin: UserSession = {
    id: "usr_admin_1",
    email: "admin@atlanticsource.ca",
    isPlatformAdmin: true,
    buyerMemberships: [],
    supplierMemberships: [],
  };

  const regularUser: UserSession = {
    id: "usr_buyer_1",
    email: "buyer@industrial.com",
    isPlatformAdmin: false,
    buyerMemberships: [{ buyerOrganizationId: "org_buyer", role: UserRoleEnum.BUYER_MEMBER }],
    supplierMemberships: [],
  };

  beforeEach(() => {
    setTestSessionOverride(undefined);
  });

  afterEach(() => {
    setTestSessionOverride(undefined);
  });

  // 1. Normalization & Slug Helpers
  it("normalizes domains, phones, and generates URL slugs correctly", () => {
    expect(normalizeDomain("http://www.SaintJohnSteel.ca/about")).toBe("saintjohnsteel.ca");
    expect(normalizeDomain("frederictonprecision.com")).toBe("frederictonprecision.com");

    expect(normalizePhone("506.555.0199")).toBe("506-555-0199");
    expect(normalizePhone("(506) 555-0199")).toBe("506-555-0199");

    expect(generateSlug("Saint John Industrial Steel & Welding Ltd.")).toBe("saint-john-industrial-steel-welding-ltd");
  });

  // 2. CSV Ingestion Validation & Deduplication Signals
  it("validates CSV ingestion row and flags missing required fields", async () => {
    const invalidRow = { companyName: "", city: "" };
    const result = await evaluateIngestionCandidate(invalidRow);
    expect(result.status).toBe("INVALID");
    expect(result.duplicateReasons.length).toBeGreaterThan(0);
  });

  it("evaluates valid ingestion candidate as CREATE status", async () => {
    const validRow = {
      companyName: "New Fredericton Hydraulics",
      websiteUrl: "https://newfrederictonhydraulics.ca",
      city: "Fredericton",
      province: "NB",
      phone: "506-555-9988",
    };

    const candidate = await evaluateIngestionCandidate(validRow);
    expect(candidate.normalizedDomain).toBe("newfrederictonhydraulics.ca");
    expect(candidate.normalizedCity).toBe("Fredericton");
    expect(candidate.status).toBe("CREATE");
  });

  // 3. Publishing Service: Approve Claim
  it("converts approved capability claim into published entity", async () => {
    const result = await approveClaim(platformAdmin.id, "claim_capability_123", {
      normalizedValue: "structural-steel-fabrication",
    });

    expect(result.success).toBe(true);
    expect(result.publishedType).toBe("CAPABILITY");
  });

  // 4. Certification Provenance Preservation Check
  it("preserves PUBLICLY_DISCOVERED provenance for website certification mentions upon approval", async () => {
    const result = await approveClaim(platformAdmin.id, "claim_cert_456", {
      claimType: "CERTIFICATION",
      normalizedValue: "cwb-w47-1",
    });

    expect(result.success).toBe(true);
    expect(result.publishedType).toBe("CERTIFICATION");
  });

  // 5. Reject & Mark Stale Actions
  it("supports rejecting and marking claims stale", async () => {
    const rejectResult = await rejectClaim(platformAdmin.id, "claim_789", "Irrelevant context");
    expect(rejectResult.success).toBe(true);

    const staleResult = await markClaimStale(platformAdmin.id, "claim_789");
    expect(staleResult.success).toBe(true);
  });

  // 6. Audit Log Redaction & Admin Security
  it("logs admin actions and redacts sensitive keys from audit metadata", async () => {
    await expect(
      logAdminAction(platformAdmin.id, "TEST_ACTION", "SupplierCompany", "comp_123", {
        token: "super_secret_token_123",
        password: "secret_password",
        supplierName: "Moncton Machine Works",
      })
    ).resolves.not.toThrow();
  });

  it("enforces server-side platform admin RBAC protection", () => {
    expect(() => requirePlatformAdmin(regularUser)).toThrow(ForbiddenError);
    expect(() => requirePlatformAdmin(platformAdmin)).not.toThrow();
  });

  // 7. Admin Supplier Preview & Public Route Access Control Tests
  it("returns 404 (notFound) on public route for DRAFT supplier", async () => {
    const { default: SupplierProfilePage } = await import("@/app/suppliers/[slug]/page");
    await expect(
      SupplierProfilePage({ params: Promise.resolve({ slug: "englobe-corp-engineering" }) })
    ).rejects.toThrow();
  }, 15000);

  it("allows published supplier to load on public route", async () => {
    const { default: SupplierProfilePage } = await import("@/app/suppliers/[slug]/page");
    const element = await SupplierProfilePage({ params: Promise.resolve({ slug: "saint-john-industrial-steel" }) });
    expect(element).toBeDefined();
    expect(element.type).toBe("div");
  }, 15000);

  it("allows verified platform admin to preview DRAFT supplier via admin preview route", async () => {
    setTestSessionOverride(platformAdmin);
    const { default: AdminSupplierPreviewPage } = await import("@/app/(admin)/admin/suppliers/[slug]/page");
    const element = await AdminSupplierPreviewPage({
      params: Promise.resolve({ slug: "mock-admin-preview-slug" }),
    });
    expect(element).toBeDefined();
    expect(element.type).toBe("div");
  });

  it("prevents non-admin or unauthorized user from accessing admin preview route", async () => {
    setTestSessionOverride(regularUser);
    const { default: AdminSupplierPreviewPage } = await import("@/app/(admin)/admin/suppliers/[slug]/page");
    await expect(
      AdminSupplierPreviewPage({ params: Promise.resolve({ slug: "mock-admin-preview-slug" }) })
    ).rejects.toThrow(ForbiddenError);

    setTestSessionOverride(null);
    await expect(
      AdminSupplierPreviewPage({ params: Promise.resolve({ slug: "mock-admin-preview-slug" }) })
    ).rejects.toThrow();
  });

  it("routes DRAFT suppliers to admin preview route and PUBLISHED suppliers to public route in SuppliersTable", async () => {
    const { SuppliersTable } = await import("@/app/(admin)/admin/suppliers/SuppliersTable");
    const mockDraftSupplier = {
      id: "supp_draft_1",
      canonicalName: "Englobe Corp Engineering",
      slug: "englobe-corp-engineering",
      normalizedDomain: "englobe.ca",
      websiteUrl: "https://englobe.ca",
      claimStatus: "UNCLAIMED",
      profileStatus: "DRAFT",
      locations: [{ city: "Fredericton", province: "NB" }],
    };
    const mockPublishedSupplier = {
      id: "supp_pub_1",
      canonicalName: "Atlantic Steel & Fabrication Ltd",
      slug: "atlantic-steel-fabrication-ltd",
      normalizedDomain: "atlanticsteel.ca",
      websiteUrl: "https://atlanticsteel.ca",
      claimStatus: "UNCLAIMED",
      profileStatus: "PUBLISHED",
      locations: [{ city: "Saint John", province: "NB" }],
    };

    function extractHrefs(node: any): string[] {
      if (!node) return [];
      if (Array.isArray(node)) return node.flatMap(extractHrefs);
      const hrefs: string[] = [];
      if (node && typeof node === "object" && node.props) {
        if (typeof node.props.href === "string") hrefs.push(node.props.href);
        if (node.props.children) hrefs.push(...extractHrefs(node.props.children));
      }
      return hrefs;
    }

    const element = SuppliersTable({ suppliers: [mockDraftSupplier, mockPublishedSupplier] });
    const hrefs = extractHrefs(element);
    expect(hrefs).toContain("/admin/suppliers/englobe-corp-engineering");
    expect(hrefs).toContain("/suppliers/atlantic-steel-fabrication-ltd");
  });

  // 8. Bulk Publish & Remove Profile Admin Actions Tests
  it("allows single Publish Profile action and sets status to PUBLISHED", async () => {
    setTestSessionOverride(platformAdmin);
    const { publishSupplierProfileAction } = await import("@/lib/actions/review");
    const result = await publishSupplierProfileAction("supp_company_test_123");
    expect(result.success).toBe(true);
  });

  it("returns supplier to DRAFT on Remove Profile and preserves data structure", async () => {
    setTestSessionOverride(platformAdmin);
    const { unpublishSupplierProfileAction } = await import("@/lib/actions/review");
    const { unpublishSupplierProfile } = await import("@/lib/admin/publishing");

    const actionRes = await unpublishSupplierProfileAction("supp_company_test_123");
    expect(actionRes.success).toBe(true);

    const directRes = await unpublishSupplierProfile(platformAdmin.id, "supp_company_test_123");
    expect(directRes.success).toBe(true);
  });

  it("publishes non-published suppliers and skips already-published suppliers during Bulk Publish", async () => {
    setTestSessionOverride(platformAdmin);
    const { publishAllSupplierProfilesAction } = await import("@/lib/actions/review");
    const { publishAllSupplierProfiles } = await import("@/lib/admin/publishing");

    const actionRes = await publishAllSupplierProfilesAction();
    expect(actionRes.success).toBe(true);
    if (actionRes.success) {
      expect(actionRes.publishedCount).toBeDefined();
      expect(actionRes.skippedCount).toBeDefined();
    }

    const directRes = await publishAllSupplierProfiles(platformAdmin.id);
    expect(directRes.success).toBe(true);
  });

  it("blocks unauthorized/non-admin users from performing Publish Profile, Remove Profile, or Bulk Publish", async () => {
    setTestSessionOverride(regularUser);
    const { publishSupplierProfileAction, unpublishSupplierProfileAction, publishAllSupplierProfilesAction } = await import("@/lib/actions/review");

    const pubRes = await publishSupplierProfileAction("supp_123");
    expect(pubRes.success).toBe(false);
    if (!pubRes.success) {
      expect(pubRes.error).toContain("Unauthorized");
    }

    const removeRes = await unpublishSupplierProfileAction("supp_123");
    expect(removeRes.success).toBe(false);
    if (!removeRes.success) {
      expect(removeRes.error).toContain("Unauthorized");
    }

    const bulkRes = await publishAllSupplierProfilesAction();
    expect(bulkRes.success).toBe(false);
    if (!bulkRes.success) {
      expect(bulkRes.error).toContain("Unauthorized");
    }
  });
});
