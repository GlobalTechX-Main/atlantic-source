"use server";

import { getCurrentUserSession } from "@/lib/auth/session";
import { approveManualClaimRequest, rejectManualClaimRequest } from "@/lib/supplier/claiming";

export async function approveCompanyClaimAction(claimRequestId: string) {
  const session = await getCurrentUserSession();
  if (!session || !session.isPlatformAdmin) {
    return { success: false, error: "Unauthorized: Platform Admin privileges required" };
  }

  try {
    return await approveManualClaimRequest(session.id, claimRequestId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to approve claim request";
    return { success: false, error: msg };
  }
}

export async function rejectCompanyClaimAction(claimRequestId: string, reason?: string) {
  const session = await getCurrentUserSession();
  if (!session || !session.isPlatformAdmin) {
    return { success: false, error: "Unauthorized: Platform Admin privileges required" };
  }

  try {
    return await rejectManualClaimRequest(session.id, claimRequestId, reason);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reject claim request";
    return { success: false, error: msg };
  }
}
