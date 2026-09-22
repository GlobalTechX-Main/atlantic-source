"use server";

import { getCurrentUserSession } from "@/lib/auth/session";
import {
  createManualSupplier,
  CreateManualSupplierInput,
  CreateManualSupplierResult,
} from "@/lib/admin/ingestion";
import { logger } from "@/lib/logger";

export async function createManualSupplierAction(
  input: CreateManualSupplierInput
): Promise<CreateManualSupplierResult> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !session.isPlatformAdmin) {
      return {
        success: false,
        error: "Unauthorized: Platform Admin privileges required",
      };
    }

    return await createManualSupplier(input, session);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unexpected server error";
    logger.error({ err }, `createManualSupplierAction error: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
