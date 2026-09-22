import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { UserSession, isBuyerAdmin, isBuyerMember, isSupplierAdmin, isSupplierMember } from "./session";

export interface SourcingRequestResource {
  id: string;
  buyerOrganizationId: string;
  creatorUserId: string;
  status: string;
  recipientSupplierCompanyIds?: string[];
}

export interface RFQRecipientResource {
  id: string;
  sourcingRequestId: string;
  supplierCompanyId: string;
}

export interface RFQMessageResource {
  id: string;
  sourcingRequestId: string;
  recipientId: string;
  targetSupplierCompanyId: string;
}

/**
 * 1. Rule: Buyer A cannot view Buyer B's private RFQ unless recipient supplier or platform admin.
 */
export function canViewSourcingRequest(
  user: UserSession | null,
  rfq: SourcingRequestResource
): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;

  // Buyer owner/member
  if (isBuyerMember(user, rfq.buyerOrganizationId)) return true;

  // Target supplier recipient
  if (rfq.recipientSupplierCompanyIds && rfq.recipientSupplierCompanyIds.length > 0) {
    return user.supplierMemberships.some((m) =>
      rfq.recipientSupplierCompanyIds?.includes(m.supplierCompanyId)
    );
  }

  return false;
}

export function assertCanViewSourcingRequest(
  user: UserSession | null,
  rfq: SourcingRequestResource
): void {
  if (!user) throw new UnauthorizedError("Authentication required");
  if (!canViewSourcingRequest(user, rfq)) {
    throw new ForbiddenError("Access denied to private sourcing request");
  }
}

/**
 * 2. Rule: Create sourcing request within buyer org.
 */
export function canCreateSourcingRequest(
  user: UserSession | null,
  buyerOrganizationId: string
): boolean {
  return isBuyerMember(user, buyerOrganizationId);
}

export function assertCanCreateSourcingRequest(
  user: UserSession | null,
  buyerOrganizationId: string
): void {
  if (!user) throw new UnauthorizedError("Authentication required");
  if (!canCreateSourcingRequest(user, buyerOrganizationId)) {
    throw new ForbiddenError("Not authorized to create sourcing requests for this organization");
  }
}

/**
 * 3. Rule: Manage buyer organization.
 */
export function canManageBuyerOrganization(
  user: UserSession | null,
  buyerOrganizationId: string
): boolean {
  return isBuyerAdmin(user, buyerOrganizationId);
}

export function assertCanManageBuyerOrganization(
  user: UserSession | null,
  buyerOrganizationId: string
): void {
  if (!user) throw new UnauthorizedError("Authentication required");
  if (!canManageBuyerOrganization(user, buyerOrganizationId)) {
    throw new ForbiddenError("Buyer Admin privileges required");
  }
}

/**
 * 4. Rule: Edit supplier profile (Supplier A cannot edit Supplier B).
 */
export function canEditSupplier(
  user: UserSession | null,
  supplierCompanyId: string
): boolean {
  return isSupplierMember(user, supplierCompanyId);
}

export function assertCanEditSupplier(
  user: UserSession | null,
  supplierCompanyId: string
): void {
  if (!user) throw new UnauthorizedError("Authentication required");
  if (!canEditSupplier(user, supplierCompanyId)) {
    throw new ForbiddenError("Not authorized to edit this supplier profile");
  }
}

/**
 * 5. Rule: Manage supplier members.
 */
export function canManageSupplierMembers(
  user: UserSession | null,
  supplierCompanyId: string
): boolean {
  return isSupplierAdmin(user, supplierCompanyId);
}

export function assertCanManageSupplierMembers(
  user: UserSession | null,
  supplierCompanyId: string
): void {
  if (!user) throw new UnauthorizedError("Authentication required");
  if (!canManageSupplierMembers(user, supplierCompanyId)) {
    throw new ForbiddenError("Supplier Admin privileges required");
  }
}

/**
 * 6. Rule: Platform admin authority.
 * Supplier or buyer users CANNOT grant AtlanticSource verification or execute admin functions.
 */
export function requirePlatformAdmin(user: UserSession | null): void {
  if (!user) throw new UnauthorizedError("Authentication required");
  if (!user.isPlatformAdmin) {
    throw new ForbiddenError("Platform Admin privileges required");
  }
}

/**
 * 7. Rule: Supplier A cannot view or reply to Supplier B's RFQ message thread.
 */
export function canViewRFQMessageThread(
  user: UserSession | null,
  buyerOrgId: string,
  targetSupplierCompanyId: string
): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;

  // Buyer owner can view
  if (isBuyerMember(user, buyerOrgId)) return true;

  // Targeted supplier member can view
  if (isSupplierMember(user, targetSupplierCompanyId)) return true;

  return false;
}

export function assertCanViewRFQMessageThread(
  user: UserSession | null,
  buyerOrgId: string,
  targetSupplierCompanyId: string
): void {
  if (!user) throw new UnauthorizedError("Authentication required");
  if (!canViewRFQMessageThread(user, buyerOrgId, targetSupplierCompanyId)) {
    throw new ForbiddenError("Not authorized to view or post in this RFQ message thread");
  }
}

/**
 * 8. Rule: Modify RFQ response (Supplier A cannot modify Supplier B's response).
 */
export function canModifyRFQResponse(
  user: UserSession | null,
  targetSupplierCompanyId: string
): boolean {
  return isSupplierMember(user, targetSupplierCompanyId);
}

export function assertCanModifyRFQResponse(
  user: UserSession | null,
  targetSupplierCompanyId: string
): void {
  if (!user) throw new UnauthorizedError("Authentication required");
  if (!canModifyRFQResponse(user, targetSupplierCompanyId)) {
    throw new ForbiddenError("Not authorized to modify another supplier's RFQ response");
  }
}
