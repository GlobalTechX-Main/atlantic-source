import crypto from "crypto";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export type RFQResponseAction = "INTERESTED" | "NEED_INFORMATION" | "DECLINED" | "VIEW";

export interface RFQTokenPayload {
  recipientId: string;
  sourcingRequestId: string;
  supplierCompanyId: string;
  action: RFQResponseAction;
  exp: number; // Expiration timestamp in ms
  nonce: string;
}

const DEFAULT_SECRET = process.env.AUTH_SECRET || "atlantic-source-rfq-hmac-secret-key-32bytes!";
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function getHmacSignature(payloadBase64: string, secret: string = DEFAULT_SECRET): string {
  return crypto.createHmac("sha256", secret).update(payloadBase64).digest("hex");
}

export function generateRFQResponseToken(
  payload: Omit<RFQTokenPayload, "exp" | "nonce"> & { exp?: number },
  secret: string = DEFAULT_SECRET
): string {
  const exp = payload.exp ?? Date.now() + DEFAULT_TTL_MS;
  const nonce = crypto.randomBytes(16).toString("hex");

  const fullPayload: RFQTokenPayload = {
    ...payload,
    exp,
    nonce,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = getHmacSignature(payloadBase64, secret);

  return `${payloadBase64}.${signature}`;
}

export function verifyRFQResponseToken(
  tokenString: string,
  secret: string = DEFAULT_SECRET
): RFQTokenPayload {
  if (!tokenString || !tokenString.includes(".")) {
    throw new UnauthorizedError("Invalid or missing response token");
  }

  const [payloadBase64, signature] = tokenString.split(".");

  if (!payloadBase64 || !signature) {
    throw new UnauthorizedError("Malformed response token format");
  }

  const expectedSignature = getHmacSignature(payloadBase64, secret);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new ForbiddenError("Token signature verification failed. Token has been tampered with.");
  }

  try {
    const payloadJson = Buffer.from(payloadBase64, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as RFQTokenPayload;

    if (!payload.recipientId || !payload.sourcingRequestId || !payload.supplierCompanyId) {
      throw new UnauthorizedError("Invalid token payload structure");
    }

    if (Date.now() > payload.exp) {
      throw new ForbiddenError("Response token has expired");
    }

    return payload;
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError("Failed to decode token payload");
  }
}
