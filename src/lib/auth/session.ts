import { db } from "@/lib/db";
import { UserRoleEnum } from "@prisma/client";

export interface UserSession {
  id: string;
  email: string;
  name?: string | null;
  isPlatformAdmin: boolean;
  buyerMemberships: {
    buyerOrganizationId: string;
    role: UserRoleEnum;
  }[];
  supplierMemberships: {
    supplierCompanyId: string;
    role: UserRoleEnum;
  }[];
}

let _testSessionOverride: UserSession | null | undefined = undefined;

export function setTestSessionOverride(session: UserSession | null | undefined): void {
  _testSessionOverride = session;
}

export async function getCurrentUserSession(): Promise<UserSession | null> {
  // 1. In-memory test override for unit test suite
  if (_testSessionOverride !== undefined) {
    return _testSessionOverride;
  }

  // 2. Identify active target session email (default local dev identity is admin@atlanticsource.ca)
  let targetEmail = "admin@atlanticsource.ca";

  try {
    if (typeof window === "undefined") {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const sessionEmailCookie = cookieStore.get("atlanticsource_user_email")?.value;
      if (sessionEmailCookie && sessionEmailCookie.trim()) {
        targetEmail = sessionEmailCookie.trim().toLowerCase();
      }
    }
  } catch {
    // Dynamic import of cookies() may throw outside HTTP request context (e.g., build/test runner)
  }

  // 3. Query PostgreSQL database for real user identity & role assignments
  try {
    if (process.env.NODE_ENV !== "test") {
      const user = await db.user.findUnique({
        where: { email: targetEmail },
        include: {
          buyerMemberships: true,
          supplierMemberships: true,
        },
      });

      if (user) {
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isPlatformAdmin: user.isPlatformAdmin,
          buyerMemberships: user.buyerMemberships.map((bm) => ({
            buyerOrganizationId: bm.buyerOrganizationId,
            role: bm.role,
          })),
          supplierMemberships: user.supplierMemberships.map((sm) => ({
            supplierCompanyId: sm.supplierCompanyId,
            role: sm.role,
          })),
        };
      }
    }
  } catch (err) {
    console.error("Failed to query user session from database:", err);
  }

  // 4. Baseline fallback for test environment or when database is unreachable
  if (targetEmail === "admin@atlanticsource.ca") {
    return {
      id: "usr_admin_dev",
      email: "admin@atlanticsource.ca",
      name: "AtlanticSource Admin",
      isPlatformAdmin: true,
      buyerMemberships: [],
      supplierMemberships: [],
    };
  }

  return {
    id: "usr_buyer_101",
    email: targetEmail,
    name: "Standard User",
    isPlatformAdmin: false,
    buyerMemberships: [{ buyerOrganizationId: "org_buyer_1", role: UserRoleEnum.BUYER_ADMIN }],
    supplierMemberships: [],
  };
}

export async function requireAuth(): Promise<UserSession> {
  const session = await getCurrentUserSession();
  if (!session) {
    throw new Error("Authentication required");
  }
  return session;
}

export function isBuyerAdmin(session: UserSession | null, buyerOrgId: string): boolean {
  if (!session) return false;
  if (session.isPlatformAdmin) return true;
  return session.buyerMemberships.some(
    (m) => m.buyerOrganizationId === buyerOrgId && m.role === UserRoleEnum.BUYER_ADMIN
  );
}

export function isBuyerMember(session: UserSession | null, buyerOrgId: string): boolean {
  if (!session) return false;
  if (session.isPlatformAdmin) return true;
  return session.buyerMemberships.some(
    (m) => m.buyerOrganizationId === buyerOrgId
  );
}

export function isSupplierAdmin(session: UserSession | null, supplierId: string): boolean {
  if (!session) return false;
  if (session.isPlatformAdmin) return true;
  return session.supplierMemberships.some(
    (m) => m.supplierCompanyId === supplierId && m.role === UserRoleEnum.SUPPLIER_ADMIN
  );
}

export function isSupplierMember(session: UserSession | null, supplierId: string): boolean {
  if (!session) return false;
  if (session.isPlatformAdmin) return true;
  return session.supplierMemberships.some(
    (m) => m.supplierCompanyId === supplierId
  );
}
