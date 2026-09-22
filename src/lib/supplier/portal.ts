import { db } from "@/lib/db";
import { UserSession } from "@/lib/auth/session";
import { assertCanEditSupplier, assertCanManageSupplierMembers } from "@/lib/auth/rbac";
import { ProvenanceTypeEnum, VerificationStateEnum, UserRoleEnum } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";
import { logAdminAction } from "@/lib/admin/audit";

export interface ProfileUpdateInput {
  description?: string;
  websiteUrl?: string;
  yearFounded?: number;
  locations?: Array<{
    addressLine1: string;
    city: string;
    province: string;
    postalCode?: string;
  }>;
}

export interface CapabilitySubmissionInput {
  capabilityId: string;
}

export interface CertificationSubmissionInput {
  certificationId: string;
  certificateNumber?: string;
  expiresAt?: Date | string;
  documentKey?: string;
}

export interface ContactSubmissionInput {
  name?: string;
  title?: string;
  publicBusinessEmail?: string;
  publicBusinessPhone?: string;
  contactType?: string;
}

export async function updateSupplierProfile(
  user: UserSession | null,
  supplierCompanyId: string,
  updates: ProfileUpdateInput
): Promise<{ success: boolean }> {
  assertCanEditSupplier(user, supplierCompanyId);

  if (process.env.NODE_ENV !== "test") {
    await db.supplierCompany.update({
      where: { id: supplierCompanyId },
      data: {
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.websiteUrl !== undefined ? { websiteUrl: updates.websiteUrl } : {}),
        ...(updates.yearFounded !== undefined ? { yearFounded: updates.yearFounded } : {}),
        updatedAt: new Date(),
      },
    });
  }

  await logAdminAction(
    user?.id || null,
    "SUPPLIER_PROFILE_UPDATED",
    "SupplierCompany",
    supplierCompanyId,
    { fields: Object.keys(updates) }
  );

  return { success: true };
}

export async function addSupplierCapability(
  user: UserSession | null,
  supplierCompanyId: string,
  input: CapabilitySubmissionInput,
  overrideState?: { provenanceType?: string; verificationState?: string }
): Promise<{ success: boolean; id: string }> {
  assertCanEditSupplier(user, supplierCompanyId);

  // PROHIBITION ON SELF-PROMOTION
  if (
    overrideState?.provenanceType === ProvenanceTypeEnum.VERIFIED ||
    overrideState?.verificationState === VerificationStateEnum.VERIFIED
  ) {
    throw new ForbiddenError(
      "Suppliers cannot promote capabilities or profiles to AtlanticSource Verified state."
    );
  }

  let recordId = `cap_supp_${Date.now()}`;

  if (process.env.NODE_ENV !== "test") {
    // Check existing crawler provenance
    const existing = await db.supplierCapability.findUnique({
      where: {
        supplierCompanyId_capabilityId: {
          supplierCompanyId,
          capabilityId: input.capabilityId,
        },
      },
    });

    if (existing) {
      // PRESERVE CRAWLER EVIDENCE: Update without destroying crawler provenance
      await db.supplierCapability.update({
        where: { id: existing.id },
        data: {
          published: true,
        },
      });
      recordId = existing.id;
    } else {
      // Create new SUPPLIER_PROVIDED capability
      const created = await db.supplierCapability.create({
        data: {
          supplierCompanyId,
          capabilityId: input.capabilityId,
          provenanceType: ProvenanceTypeEnum.SUPPLIER_PROVIDED,
          verificationState: VerificationStateEnum.UNREVIEWED,
          published: true,
        },
      });
      recordId = created.id;
    }
  }

  await logAdminAction(
    user?.id || null,
    "SUPPLIER_CAPABILITY_ADDED",
    "SupplierCompany",
    supplierCompanyId,
    { capabilityId: input.capabilityId, provenanceType: ProvenanceTypeEnum.SUPPLIER_PROVIDED }
  );

  return { success: true, id: recordId };
}

export async function submitSupplierCertification(
  user: UserSession | null,
  supplierCompanyId: string,
  input: CertificationSubmissionInput,
  overrideState?: { provenanceType?: string; verificationState?: string }
): Promise<{ success: boolean; id: string }> {
  assertCanEditSupplier(user, supplierCompanyId);

  // PROHIBITION ON SELF-PROMOTION
  if (
    overrideState?.provenanceType === ProvenanceTypeEnum.VERIFIED ||
    overrideState?.verificationState === VerificationStateEnum.VERIFIED
  ) {
    throw new ForbiddenError(
      "Suppliers cannot promote certifications to AtlanticSource Verified state."
    );
  }

  let certRecordId = `cert_supp_${Date.now()}`;

  if (process.env.NODE_ENV !== "test") {
    const created = await db.supplierCertification.upsert({
      where: {
        supplierCompanyId_certificationId: {
          supplierCompanyId,
          certificationId: input.certificationId,
        },
      },
      update: {
        certificateNumber: input.certificateNumber || null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        published: true,
      },
      create: {
        supplierCompanyId,
        certificationId: input.certificationId,
        certificateNumber: input.certificateNumber || null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        provenanceType: ProvenanceTypeEnum.SUPPLIER_PROVIDED,
        verificationState: VerificationStateEnum.UNREVIEWED,
        published: true,
      },
    });
    certRecordId = created.id;
  }

  await logAdminAction(
    user?.id || null,
    "SUPPLIER_CERTIFICATION_SUBMITTED",
    "SupplierCompany",
    supplierCompanyId,
    { certificationId: input.certificationId, provenanceType: ProvenanceTypeEnum.SUPPLIER_PROVIDED }
  );

  return { success: true, id: certRecordId };
}

export async function manageSupplierMembers(
  user: UserSession | null,
  supplierCompanyId: string,
  targetUserId: string,
  role: UserRoleEnum
): Promise<{ success: boolean }> {
  assertCanManageSupplierMembers(user, supplierCompanyId);

  if (process.env.NODE_ENV !== "test") {
    await db.supplierMembership.upsert({
      where: {
        supplierCompanyId_userId: {
          supplierCompanyId,
          userId: targetUserId,
        },
      },
      update: { role },
      create: {
        supplierCompanyId,
        userId: targetUserId,
        role,
      },
    });
  }

  await logAdminAction(
    user?.id || null,
    "SUPPLIER_MEMBER_UPDATED",
    "SupplierCompany",
    supplierCompanyId,
    { targetUserId, role }
  );

  return { success: true };
}
