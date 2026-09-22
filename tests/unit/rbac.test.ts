import { describe, it, expect } from "vitest";
import { UserRoleEnum } from "@prisma/client";
import { UserSession } from "@/lib/auth/session";
import {
  canViewSourcingRequest,
  assertCanViewSourcingRequest,
  canCreateSourcingRequest,
  canManageBuyerOrganization,
  canEditSupplier,
  assertCanEditSupplier,
  canManageSupplierMembers,
  requirePlatformAdmin,
  canViewRFQMessageThread,
  canModifyRFQResponse,
  assertCanModifyRFQResponse,
} from "@/lib/auth/rbac";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

describe("Mandatory Negative Authorization Checks (RBAC)", () => {
  // Test Fixtures
  const buyerUserA: UserSession = {
    id: "usr_buyer_a",
    email: "buyer_a@industrialbuyer.com",
    isPlatformAdmin: false,
    buyerMemberships: [{ buyerOrganizationId: "org_buyer_a", role: UserRoleEnum.BUYER_MEMBER }],
    supplierMemberships: [],
  };

  const buyerAdminA: UserSession = {
    id: "usr_buyer_admin_a",
    email: "admin_a@industrialbuyer.com",
    isPlatformAdmin: false,
    buyerMemberships: [{ buyerOrganizationId: "org_buyer_a", role: UserRoleEnum.BUYER_ADMIN }],
    supplierMemberships: [],
  };

  const buyerUserB: UserSession = {
    id: "usr_buyer_b",
    email: "buyer_b@marinecorp.com",
    isPlatformAdmin: false,
    buyerMemberships: [{ buyerOrganizationId: "org_buyer_b", role: UserRoleEnum.BUYER_MEMBER }],
    supplierMemberships: [],
  };

  const supplierUserA: UserSession = {
    id: "usr_supplier_a",
    email: "john@saintjohnsteel.com",
    isPlatformAdmin: false,
    buyerMemberships: [],
    supplierMemberships: [{ supplierCompanyId: "org_supplier_saint_john", role: UserRoleEnum.SUPPLIER_MEMBER }],
  };

  const supplierAdminA: UserSession = {
    id: "usr_supplier_admin_a",
    email: "admin@saintjohnsteel.com",
    isPlatformAdmin: false,
    buyerMemberships: [],
    supplierMemberships: [{ supplierCompanyId: "org_supplier_saint_john", role: UserRoleEnum.SUPPLIER_ADMIN }],
  };

  const supplierUserB: UserSession = {
    id: "usr_supplier_b",
    email: "dave@monctonwelding.com",
    isPlatformAdmin: false,
    buyerMemberships: [],
    supplierMemberships: [{ supplierCompanyId: "org_supplier_moncton", role: UserRoleEnum.SUPPLIER_MEMBER }],
  };

  const platformAdmin: UserSession = {
    id: "usr_admin",
    email: "admin@atlanticsource.ca",
    isPlatformAdmin: true,
    buyerMemberships: [],
    supplierMemberships: [],
  };

  const rfqBuyerB = {
    id: "rfq_buyer_b_123",
    buyerOrganizationId: "org_buyer_b",
    creatorUserId: buyerUserB.id,
    status: "SENT",
    recipientSupplierCompanyIds: ["org_supplier_saint_john"],
  };

  // ---------------------------------------------------------------------------
  // 1. Buyer A cannot view Buyer B's private RFQ
  // ---------------------------------------------------------------------------
  it("1. Buyer A cannot view Buyer B's private RFQ", () => {
    const canView = canViewSourcingRequest(buyerUserA, rfqBuyerB);
    expect(canView).toBe(false);

    expect(() => assertCanViewSourcingRequest(buyerUserA, rfqBuyerB)).toThrow(ForbiddenError);
  });

  // ---------------------------------------------------------------------------
  // 2. Buyer A cannot access Buyer B's private RFQ attachment metadata
  // ---------------------------------------------------------------------------
  it("2. Buyer A cannot access Buyer B's private RFQ attachment metadata", () => {
    // Attempting to authorize attachment download for RFQ owned by Buyer B
    expect(() => assertCanViewSourcingRequest(buyerUserA, rfqBuyerB)).toThrow("Access denied");
  });

  // ---------------------------------------------------------------------------
  // 3. Supplier A cannot edit Supplier B
  // ---------------------------------------------------------------------------
  it("3. Supplier A cannot edit Supplier B", () => {
    const canEdit = canEditSupplier(supplierUserA, "org_supplier_moncton");
    expect(canEdit).toBe(false);

    expect(() => assertCanEditSupplier(supplierUserA, "org_supplier_moncton")).toThrow(ForbiddenError);
  });

  // ---------------------------------------------------------------------------
  // 4. Supplier cannot mark itself AtlanticSource Verified
  // ---------------------------------------------------------------------------
  it("4. Supplier cannot mark itself AtlanticSource Verified", () => {
    expect(() => requirePlatformAdmin(supplierAdminA)).toThrow(ForbiddenError);
  });

  // ---------------------------------------------------------------------------
  // 5. Public/unauthenticated user cannot access private buyer or supplier dashboards
  // ---------------------------------------------------------------------------
  it("5. Public/unauthenticated user cannot access private buyer or supplier dashboards", () => {
    const unauthenticatedUser = null;

    expect(canViewSourcingRequest(unauthenticatedUser, rfqBuyerB)).toBe(false);
    expect(canCreateSourcingRequest(unauthenticatedUser, "org_buyer_a")).toBe(false);
    expect(canEditSupplier(unauthenticatedUser, "org_supplier_saint_john")).toBe(false);

    expect(() => assertCanViewSourcingRequest(unauthenticatedUser, rfqBuyerB)).toThrow(UnauthorizedError);
  });

  // ---------------------------------------------------------------------------
  // 6. Non-platform-admin cannot access platform administration functionality
  // ---------------------------------------------------------------------------
  it("6. Non-platform-admin cannot access platform administration functionality", () => {
    expect(() => requirePlatformAdmin(buyerUserA)).toThrow(ForbiddenError);
    expect(() => requirePlatformAdmin(buyerAdminA)).toThrow(ForbiddenError);
    expect(() => requirePlatformAdmin(supplierUserA)).toThrow(ForbiddenError);
    expect(() => requirePlatformAdmin(supplierAdminA)).toThrow(ForbiddenError);

    // Platform admin passes cleanly
    expect(() => requirePlatformAdmin(platformAdmin)).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // 7. Supplier cannot modify another supplier's RFQ response
  // ---------------------------------------------------------------------------
  it("7. Supplier cannot modify another supplier's RFQ response", () => {
    const canModify = canModifyRFQResponse(supplierUserA, "org_supplier_moncton");
    expect(canModify).toBe(false);

    expect(() => assertCanModifyRFQResponse(supplierUserA, "org_supplier_moncton")).toThrow(ForbiddenError);
  });

  // ---------------------------------------------------------------------------
  // 8. Buyer member cannot perform buyer-admin actions unless explicitly authorized
  // ---------------------------------------------------------------------------
  it("8. Buyer member cannot perform buyer-admin actions unless explicitly authorized", () => {
    const canManageOrg = canManageBuyerOrganization(buyerUserA, "org_buyer_a");
    expect(canManageOrg).toBe(false);

    // Buyer admin passes
    const adminCanManage = canManageBuyerOrganization(buyerAdminA, "org_buyer_a");
    expect(adminCanManage).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 9. Supplier member cannot perform supplier-admin actions unless explicitly authorized
  // ---------------------------------------------------------------------------
  it("9. Supplier member cannot perform supplier-admin actions unless explicitly authorized", () => {
    const canManageMembers = canManageSupplierMembers(supplierUserA, "org_supplier_saint_john");
    expect(canManageMembers).toBe(false);

    // Supplier admin passes
    const adminCanManage = canManageSupplierMembers(supplierAdminA, "org_supplier_saint_john");
    expect(adminCanManage).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 10. Direct route/API access fails even when UI controls are bypassed (Supplier A viewing Supplier B message thread)
  // ---------------------------------------------------------------------------
  it("10. Direct route/API access fails even when UI controls are bypassed", () => {
    // Supplier B attempting to view Supplier A's message thread with Buyer B
    const canViewThread = canViewRFQMessageThread(
      supplierUserB,
      "org_buyer_b",
      "org_supplier_saint_john" // RFQ recipient target
    );
    expect(canViewThread).toBe(false);

    // Supplier A (the intended recipient) can view thread
    const supplierACanView = canViewRFQMessageThread(
      supplierUserA,
      "org_buyer_b",
      "org_supplier_saint_john"
    );
    expect(supplierACanView).toBe(true);
  });
});
