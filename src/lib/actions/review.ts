"use server";

import { getCurrentUserSession } from "@/lib/auth/session";
import { approveClaim, rejectClaim, markClaimStale, ClaimApprovalOverrides } from "@/lib/admin/publishing";

export async function approveClaimAction(claimId: string, overrides?: ClaimApprovalOverrides) {
  const session = await getCurrentUserSession();
  if (!session || !session.isPlatformAdmin) {
    return { success: false, error: "Unauthorized: Platform Admin privileges required" };
  }

  try {
    return await approveClaim(session.id, claimId, overrides);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to approve claim";
    return { success: false, error: errorMsg };
  }
}

export async function rejectClaimAction(claimId: string, reason?: string, supportingClaimIds?: string[]) {
  const session = await getCurrentUserSession();
  if (!session || !session.isPlatformAdmin) {
    return { success: false, error: "Unauthorized: Platform Admin privileges required" };
  }

  try {
    return await rejectClaim(session.id, claimId, reason, supportingClaimIds);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reject claim";
    return { success: false, error: errorMsg };
  }
}

export async function markClaimStaleAction(claimId: string, supportingClaimIds?: string[]) {
  const session = await getCurrentUserSession();
  if (!session || !session.isPlatformAdmin) {
    return { success: false, error: "Unauthorized: Platform Admin privileges required" };
  }

  try {
    return await markClaimStale(session.id, claimId, supportingClaimIds);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to mark claim stale";
    return { success: false, error: errorMsg };
  }
}

export type ActionResponse<T = Record<string, unknown>> =
  | ({ success: true; error?: undefined } & T)
  | { success: false; error: string };

export async function publishSupplierProfileAction(supplierId: string): Promise<ActionResponse> {
  const session = await getCurrentUserSession();
  if (!session || !session.isPlatformAdmin) {
    return { success: false, error: "Unauthorized: Platform Admin privileges required" };
  }

  try {
    const { publishSupplierProfile } = await import("@/lib/admin/publishing");
    await publishSupplierProfile(session.id, supplierId);
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/suppliers");
      revalidatePath("/admin/suppliers");
    } catch {
      // Ignore outside HTTP request context
    }
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to publish supplier profile";
    return { success: false, error: errorMsg };
  }
}

export async function unpublishSupplierProfileAction(supplierId: string): Promise<ActionResponse> {
  const session = await getCurrentUserSession();
  if (!session || !session.isPlatformAdmin) {
    return { success: false, error: "Unauthorized: Platform Admin privileges required" };
  }

  try {
    const { unpublishSupplierProfile } = await import("@/lib/admin/publishing");
    await unpublishSupplierProfile(session.id, supplierId);
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/suppliers");
      revalidatePath("/admin/suppliers");
    } catch {
      // Ignore outside HTTP request context
    }
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to remove supplier profile";
    return { success: false, error: errorMsg };
  }
}

export async function publishAllSupplierProfilesAction(): Promise<
  ActionResponse<{ publishedCount: number; skippedCount: number }>
> {
  const session = await getCurrentUserSession();
  if (!session || !session.isPlatformAdmin) {
    return { success: false, error: "Unauthorized: Platform Admin privileges required" };
  }

  try {
    const { publishAllSupplierProfiles } = await import("@/lib/admin/publishing");
    const result = await publishAllSupplierProfiles(session.id);
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/suppliers");
      revalidatePath("/admin/suppliers");
    } catch {
      // Ignore outside HTTP request context
    }
    return {
      success: true,
      publishedCount: result.publishedCount,
      skippedCount: result.skippedCount,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to publish all supplier profiles";
    return { success: false, error: errorMsg };
  }
}
