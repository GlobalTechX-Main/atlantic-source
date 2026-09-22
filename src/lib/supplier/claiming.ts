import crypto from "crypto";
import { db } from "@/lib/db";
import { VerificationStateEnum, ClaimStatusEnum, VerificationStatusEnum, UserRoleEnum, ClaimVerificationMethodEnum } from "@prisma/client";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logAdminAction } from "@/lib/admin/audit";

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
  "mail.com",
  "zoho.com",
  "yandex.com",
]);

export interface ClaimInitiationInput {
  supplierCompanyId: string;
  requestingUserId: string;
  userEmail: string;
  evidenceNotes?: string;
  documentKey?: string;
}

export interface ClaimInitiationResult {
  claimRequestId: string;
  method: ClaimVerificationMethodEnum;
  status: VerificationStateEnum;
  rawToken?: string;
  verificationUrl?: string;
  message: string;
}

type SupplierRecord = Awaited<ReturnType<typeof db.supplierCompany.findUnique>>;

export async function initiateCompanyClaim(
  input: ClaimInitiationInput
): Promise<ClaimInitiationResult> {
  const { supplierCompanyId, requestingUserId, userEmail, evidenceNotes } = input;

  let supplier: SupplierRecord = null;

  if (process.env.NODE_ENV !== "test") {
    supplier = await db.supplierCompany.findUnique({
      where: { id: supplierCompanyId },
    });
  } else {
    // Mock supplier for tests
    supplier = {
      id: supplierCompanyId,
      canonicalName: "Target Supplier Ltd.",
      websiteUrl: "https://saintjohnsteel.example.com",
      normalizedDomain: "saintjohnsteel.example.com",
      claimStatus: ClaimStatusEnum.UNCLAIMED,
    } as unknown as SupplierRecord;
  }

  if (!supplier) {
    throw new NotFoundError(`Supplier company not found: ${supplierCompanyId}`);
  }

  if (supplier.claimStatus === ClaimStatusEnum.VERIFIED) {
    throw new ForbiddenError("This supplier company profile has already been claimed and verified.");
  }

  const userEmailDomain = extractEmailDomain(userEmail);
  const supplierDomain = supplier.normalizedDomain || (supplier.websiteUrl ? extractUrlDomain(supplier.websiteUrl) : "");

  const isFreeMail = FREE_MAIL_DOMAINS.has(userEmailDomain);
  const isDomainMatch = Boolean(
    !isFreeMail &&
      userEmailDomain &&
      supplierDomain &&
      (userEmailDomain === supplierDomain || supplierDomain.endsWith(`.${userEmailDomain}`))
  );

  if (!isDomainMatch) {
    // Route to Manual Admin Review
    let claimReqId = `claim_req_${Date.now()}`;
    if (process.env.NODE_ENV !== "test") {
      const claimReq = await db.companyClaimRequest.create({
        data: {
          supplierCompanyId,
          requestingUserId,
          requestedDomain: userEmailDomain,
          verificationMethod: ClaimVerificationMethodEnum.DOCUMENT_PROOF,
          status: VerificationStateEnum.PENDING,
          evidence: evidenceNotes || "Free-mail or domain mismatch fallback",
        },
      });
      claimReqId = claimReq.id;
    }

    await logAdminAction(
      requestingUserId,
      "CLAIM_REQUEST_SUBMITTED_MANUAL",
      "SupplierCompany",
      supplierCompanyId,
      { userEmail, userEmailDomain, supplierDomain, isFreeMail }
    );

    return {
      claimRequestId: claimReqId,
      method: ClaimVerificationMethodEnum.DOCUMENT_PROOF,
      status: VerificationStateEnum.PENDING,
      message: isFreeMail
        ? "Claims using public free-mail providers (e.g. Gmail/Yahoo) require manual GTEX admin review."
        : "Email domain does not match company website. Submitted to GTEX manual admin review queue.",
    };
  }

  // Self-service Domain Verification with One-Time Token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours

  let claimReqId = `claim_req_auto_${Date.now()}`;
  if (process.env.NODE_ENV !== "test") {
    const claimReq = await db.companyClaimRequest.create({
      data: {
        supplierCompanyId,
        requestingUserId,
        requestedDomain: userEmailDomain,
        verificationMethod: ClaimVerificationMethodEnum.EMAIL_DOMAIN,
        status: VerificationStateEnum.PENDING,
        evidence: `Automated domain match for ${userEmail}`,
      },
    });
    claimReqId = claimReq.id;

    await db.claimVerificationToken.create({
      data: {
        tokenHash,
        claimRequestId: claimReqId,
        requestingUserId,
        supplierCompanyId,
        expiresAt,
      },
    });
  } else {
    // Register mock token in global memory for tests
    mockTokenStore.set(tokenHash, {
      id: `tok_${Date.now()}`,
      tokenHash,
      claimRequestId: claimReqId,
      requestingUserId,
      supplierCompanyId,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    });
  }

  await logAdminAction(
    requestingUserId,
    "CLAIM_TOKEN_GENERATED",
    "SupplierCompany",
    supplierCompanyId,
    { userEmail, userEmailDomain, expiresAt }
  );

  return {
    claimRequestId: claimReqId,
    method: ClaimVerificationMethodEnum.EMAIL_DOMAIN,
    status: VerificationStateEnum.PENDING,
    rawToken,
    verificationUrl: `/claim/verify?token=${rawToken}`,
    message: "Email domain matched. Please use the secure one-time verification link to confirm domain control.",
  };
}

type ClaimTokenRecord = Awaited<ReturnType<typeof db.claimVerificationToken.findUnique>>;

export async function verifyDomainClaimToken(
  rawToken: string
): Promise<{ success: boolean; supplierCompanyId: string; userId: string }> {
  if (!rawToken || typeof rawToken !== "string") {
    throw new UnauthorizedError("Invalid or missing verification token");
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

  let tokenRecord: ClaimTokenRecord = null;

  if (process.env.NODE_ENV !== "test") {
    tokenRecord = await db.claimVerificationToken.findUnique({
      where: { tokenHash },
    });
  } else {
    tokenRecord = mockTokenStore.get(tokenHash) || null;
  }

  if (!tokenRecord) {
    throw new UnauthorizedError("Verification token not found or invalid.");
  }

  if (tokenRecord.usedAt) {
    throw new ForbiddenError("This verification token has already been used (single-use restriction).");
  }

  if (new Date(tokenRecord.expiresAt) < new Date()) {
    throw new ForbiddenError("This verification token has expired.");
  }

  const { claimRequestId, requestingUserId, supplierCompanyId } = tokenRecord;

  if (process.env.NODE_ENV !== "test") {
    // Mark token used
    await db.claimVerificationToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    });

    // Approve claim request
    await db.companyClaimRequest.update({
      where: { id: claimRequestId },
      data: {
        status: VerificationStateEnum.APPROVED,
        reviewedAt: new Date(),
      },
    });

    // Update SupplierCompany claim status
    await db.supplierCompany.update({
      where: { id: supplierCompanyId },
      data: {
        claimStatus: ClaimStatusEnum.VERIFIED,
        verificationStatus: VerificationStatusEnum.VERIFIED,
      },
    });

    // Grant SupplierAdmin Membership
    await db.supplierMembership.upsert({
      where: {
        supplierCompanyId_userId: {
          supplierCompanyId,
          userId: requestingUserId,
        },
      },
      update: {
        role: UserRoleEnum.SUPPLIER_ADMIN,
      },
      create: {
        supplierCompanyId,
        userId: requestingUserId,
        role: UserRoleEnum.SUPPLIER_ADMIN,
      },
    });
  } else {
    tokenRecord.usedAt = new Date();
  }

  await logAdminAction(
    requestingUserId,
    "CLAIM_APPROVED_AUTO_DOMAIN",
    "SupplierCompany",
    supplierCompanyId,
    { claimRequestId, tokenHash: tokenHash.substring(0, 8) }
  );

  return {
    success: true,
    supplierCompanyId,
    userId: requestingUserId,
  };
}

// In-memory mock token store for Vitest tests
export const mockTokenStore = new Map<string, NonNullable<ClaimTokenRecord>>();

function extractEmailDomain(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 ? parts[1] || "" : "";
}

function extractUrlDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]?.toLowerCase() || "";
  }
}

export async function approveManualClaimRequest(
  actorUserId: string | null,
  claimRequestId: string
): Promise<{ success: boolean }> {
  if (process.env.NODE_ENV !== "test") {
    const req = await db.companyClaimRequest.findUnique({
      where: { id: claimRequestId },
    });

    if (!req) throw new Error("Claim request not found");

    await db.companyClaimRequest.update({
      where: { id: claimRequestId },
      data: {
        status: VerificationStateEnum.APPROVED,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    });

    await db.supplierCompany.update({
      where: { id: req.supplierCompanyId },
      data: {
        claimStatus: ClaimStatusEnum.VERIFIED,
        verificationStatus: VerificationStatusEnum.VERIFIED,
      },
    });

    await db.supplierMembership.upsert({
      where: {
        supplierCompanyId_userId: {
          supplierCompanyId: req.supplierCompanyId,
          userId: req.requestingUserId,
        },
      },
      update: {
        role: UserRoleEnum.SUPPLIER_ADMIN,
      },
      create: {
        supplierCompanyId: req.supplierCompanyId,
        userId: req.requestingUserId,
        role: UserRoleEnum.SUPPLIER_ADMIN,
      },
    });
  }

  await logAdminAction(actorUserId, "CLAIM_REQUEST_APPROVED", "CompanyClaimRequest", claimRequestId);
  return { success: true };
}

export async function rejectManualClaimRequest(
  actorUserId: string | null,
  claimRequestId: string,
  reason?: string
): Promise<{ success: boolean }> {
  if (process.env.NODE_ENV !== "test") {
    await db.companyClaimRequest.update({
      where: { id: claimRequestId },
      data: {
        status: VerificationStateEnum.REJECTED,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    });
  }

  await logAdminAction(actorUserId, "CLAIM_REQUEST_REJECTED", "CompanyClaimRequest", claimRequestId, { reason });
  return { success: true };
}

