import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const REDACT_KEYS = ["token", "secret", "password", "key", "auth", "magicLink"];

function sanitizeMetadata(metadata?: Record<string, unknown>): string | null {
  if (!metadata) return null;

  try {
    const cleaned = { ...metadata };
    for (const key of Object.keys(cleaned)) {
      if (REDACT_KEYS.some((rk) => key.toLowerCase().includes(rk.toLowerCase()))) {
        cleaned[key] = "[REDACTED]";
      }
    }
    return JSON.stringify(cleaned);
  } catch {
    return null;
  }
}

export async function logAdminAction(
  actorUserId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const safeMetadata = sanitizeMetadata(metadata);

  try {
    if (process.env.NODE_ENV !== "test") {
      let validActorUserId: string | null = null;
      if (actorUserId && !actorUserId.startsWith("system-")) {
        const userExists = await db.user.findUnique({ where: { id: actorUserId } });
        if (userExists) validActorUserId = actorUserId;
      }

      await db.auditLog.create({
        data: {
          actorUserId: validActorUserId,
          action,
          targetType,
          targetId,
          metadata: safeMetadata,
        },
      });
    }
    logger.info({ actorUserId, action, targetType, targetId }, `Admin Action Logged: ${action}`);
  } catch (err) {
    logger.error({ err, action, targetId }, "Failed to write AuditLog");
  }
}
