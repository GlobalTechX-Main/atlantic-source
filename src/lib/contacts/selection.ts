import { ContactTypeEnum, ProvenanceTypeEnum, VerificationStateEnum } from "@prisma/client";
import { db } from "@/lib/db";
import { isUsableRfqEmail, isUsableRfqPhone } from "./usability";

/** NB 506/428, NS and PEI 902/782, NL 709/879. */
const ATLANTIC_AREA_CODES = new Set(["506", "428", "902", "782", "709", "879"]);
const TOLL_FREE_AREA_CODES = new Set(["800", "833", "844", "855", "866", "877", "888"]);

export interface RankedContactCandidate {
  claimId?: string;
  rawValue: string;
  normalizedValue: string;
  isEmail: boolean;
  isPhone: boolean;
  score: number;
  contactType: ContactTypeEnum;
  selectionReason: string;
  sourceDocumentId?: string | null;
}

export interface SupplierRfqSelectionResult {
  primary: RankedContactCandidate | null;
  backups: RankedContactCandidate[];
  allSelected: RankedContactCandidate[];
  rejectedClaimIds: string[];
  /** Usable contacts that simply ranked below the chosen three. */
  demotedClaimIds: string[];
  ambiguousClaimIds: string[];
}

/**
 * Ranks a contact email or phone string based on RFQ outreach priority:
 * 1. rfq@ (Score: 1000, ContactType: PROCUREMENT)
 * 2. estimating@ / quotes@ (Score: 900, ContactType: ESTIMATING)
 * 3. sales@ (Score: 850, ContactType: SALES)
 * 4. procurement@ (Score: 800, ContactType: PROCUREMENT)
 * 5. businessdevelopment@ / bizdev@ (Score: 750, ContactType: SALES)
 * 6. info@ / inquiries@ / contact@ / general@ (Score: 600, ContactType: GENERAL)
 * 7. Supplier-domain employee email with commercial context (Score: 500, ContactType: INDIVIDUAL_BUSINESS_CONTACT)
 * 8. Supplier-domain employee email neutral (Score: 300, ContactType: INDIVIDUAL_BUSINESS_CONTACT)
 * 9. Local business phone (Score: 400, ContactType: GENERAL)
 */
export function scoreContactCandidate(
  rawValue: string,
  supplierDomain?: string | null,
  evidenceText?: string | null,
  pageType?: string | null
): { score: number; contactType: ContactTypeEnum; reason: string; isExcluded: boolean } {
  const norm = rawValue.trim().toLowerCase();

  const cleanDigits = norm.replace(/\D/g, "");

  // A. Phone number handling
  if (!norm.includes("@") && cleanDigits.length >= 7) {
    const phoneCheck = isUsableRfqPhone(norm);
    if (!phoneCheck.usable) {
      return { score: 0, contactType: ContactTypeEnum.GENERAL, reason: phoneCheck.reason || "Invalid phone number", isExcluded: true };
    }

    const lowerContext = `${evidenceText || ""} ${pageType || ""}`.toLowerCase();
    const isNonRFQPhone = /\b(payroll|retirement|helpdesk|hr|investors?|media|careers?|recruiting)\b/i.test(lowerContext);

    if (isNonRFQPhone) {
      return { score: 0, contactType: ContactTypeEnum.GENERAL, reason: "Phone number associated with HR/payroll/media", isExcluded: true };
    }

    // Prefer numbers people in Atlantic Canada would actually call about a local job.
    const digits10 = cleanDigits.length === 11 && cleanDigits.startsWith("1") ? cleanDigits.slice(1) : cleanDigits;
    const areaCode = digits10.slice(0, 3);
    if (ATLANTIC_AREA_CODES.has(areaCode)) {
      return { score: 450, contactType: ContactTypeEnum.GENERAL, reason: "Atlantic Canada business phone number", isExcluded: false };
    }
    if (TOLL_FREE_AREA_CODES.has(areaCode)) {
      return { score: 420, contactType: ContactTypeEnum.GENERAL, reason: "Toll-free business phone number", isExcluded: false };
    }
    return { score: 200, contactType: ContactTypeEnum.GENERAL, reason: "Business phone number outside Atlantic Canada", isExcluded: false };
  }

  // B. Email address handling
  if (norm.includes("@")) {
    const emailCheck = isUsableRfqEmail(norm, supplierDomain, evidenceText);
    if (!emailCheck.usable) {
      return { score: 0, contactType: ContactTypeEnum.OTHER, reason: emailCheck.reason || "Non-RFQ email address", isExcluded: true };
    }

    const [localPart, emailDomain] = norm.split("@");
    const cleanLocal = (localPart || "").toLowerCase();

    // 1. rfq@
    if (cleanLocal === "rfq" || cleanLocal.startsWith("rfq.") || cleanLocal.startsWith("rfq_")) {
      return { score: 1000, contactType: ContactTypeEnum.PROCUREMENT, reason: "Explicit RFQ procurement address (rfq@)", isExcluded: false };
    }

    // 2. estimating@ / quotes@
    if (
      cleanLocal === "estimating" ||
      cleanLocal.startsWith("estimating.") ||
      cleanLocal.startsWith("estimating_") ||
      cleanLocal === "quotes" ||
      cleanLocal === "quote" ||
      cleanLocal.startsWith("quote.")
    ) {
      return { score: 900, contactType: ContactTypeEnum.ESTIMATING, reason: "Explicit estimating/quoting address", isExcluded: false };
    }

    // 3. sales@
    if (cleanLocal === "sales" || cleanLocal.startsWith("sales.") || cleanLocal.startsWith("sales_")) {
      return { score: 850, contactType: ContactTypeEnum.SALES, reason: "Explicit sales department address (sales@)", isExcluded: false };
    }

    // 4. procurement@
    if (cleanLocal === "procurement" || cleanLocal.startsWith("procurement.") || cleanLocal.startsWith("procurement_")) {
      return { score: 800, contactType: ContactTypeEnum.PROCUREMENT, reason: "Explicit procurement address (procurement@)", isExcluded: false };
    }

    // 5. businessdevelopment@ / bizdev@
    if (
      cleanLocal === "businessdevelopment" ||
      cleanLocal.startsWith("businessdevelopment.") ||
      cleanLocal === "bizdev" ||
      cleanLocal.startsWith("bizdev.")
    ) {
      return { score: 750, contactType: ContactTypeEnum.SALES, reason: "Business development contact address", isExcluded: false };
    }

    // 6. info@ / inquiries@ / contact@ / general@
    const GENERAL_PREFIXES = ["info", "inquiries", "inquiry", "contact", "general", "office", "admin", "frontdesk", "orders", "commercial"];
    if (GENERAL_PREFIXES.some((p) => cleanLocal === p || cleanLocal.startsWith(`${p}.`) || cleanLocal.startsWith(`${p}_`))) {
      return { score: 600, contactType: ContactTypeEnum.GENERAL, reason: "General business inquiry address (info@/contact@)", isExcluded: false };
    }

    // 7. Supplier-domain employee email validation
    const normSupplierDomain = supplierDomain ? supplierDomain.toLowerCase().replace(/^www\./, "").trim() : "";
    const normEmailDomain = (emailDomain || "").toLowerCase().replace(/^www\./, "").trim();

    const isDomainMatch =
      normSupplierDomain &&
      (normEmailDomain === normSupplierDomain ||
        normEmailDomain.endsWith(`.${normSupplierDomain}`) ||
        normSupplierDomain.endsWith(`.${normEmailDomain}`));

    if (isDomainMatch) {
      const lowerContext = `${evidenceText || ""} ${pageType || ""}`.toLowerCase();
      const hasCommercialContext =
        lowerContext.includes("sales") ||
        lowerContext.includes("estimating") ||
        lowerContext.includes("commercial") ||
        lowerContext.includes("operations") ||
        lowerContext.includes("contact") ||
        lowerContext.includes("services") ||
        lowerContext.includes("engineering") ||
        lowerContext.includes("branch") ||
        lowerContext.includes("manager") ||
        lowerContext.includes("dispatch") ||
        pageType === "CONTACT" ||
        pageType === "SERVICES";

      if (hasCommercialContext) {
        return {
          score: 500,
          contactType: ContactTypeEnum.INDIVIDUAL_BUSINESS_CONTACT,
          reason: "Supplier-domain employee email with commercial page context",
          isExcluded: false,
        };
      } else {
        return {
          score: 300,
          contactType: ContactTypeEnum.INDIVIDUAL_BUSINESS_CONTACT,
          reason: "Supplier-domain employee email with neutral context",
          isExcluded: false,
        };
      }
    }
  }

  return { score: 0, contactType: ContactTypeEnum.OTHER, reason: "Unmatched or low-confidence contact string", isExcluded: true };
}

/**
 * Selects up to 3 RFQ contacts (1 Primary, up to 2 Backups) for a supplier from raw extracted claims.
 */
export function selectRfqContactsFromClaims(
  claims: Array<{
    id: string;
    claimType: string;
    rawValue: string;
    normalizedValue: string | null;
    evidenceText?: string | null;
    sourceDocumentId?: string | null;
  }>,
  supplierDomain?: string | null
): SupplierRfqSelectionResult {
  const rankedCandidates: RankedContactCandidate[] = [];
  const rejectedClaimIds: string[] = [];
  const demotedClaimIds: string[] = [];
  const ambiguousClaimIds: string[] = [];

  const seenValues = new Set<string>();

  for (const c of claims) {
    if (c.claimType !== "CONTACT" && c.claimType !== "CONTACT_EMAIL" && c.claimType !== "CONTACT_PHONE") {
      continue;
    }

    const val = (c.normalizedValue || c.rawValue || "").trim();
    if (!val) {
      rejectedClaimIds.push(c.id);
      continue;
    }

    // "+1 506-633-7740" and "5066337740" are the same number.
    const digitsOnly = val.replace(/\D/g, "");
    const normKey = !val.includes("@") && digitsOnly.length >= 10 ? digitsOnly.slice(-10) : val.toLowerCase();
    if (seenValues.has(normKey)) {
      // Duplicate claim
      rejectedClaimIds.push(c.id);
      continue;
    }

    const evalResult = scoreContactCandidate(val, supplierDomain, c.evidenceText);

    if (evalResult.isExcluded) {
      rejectedClaimIds.push(c.id);
      continue;
    }

    seenValues.add(normKey);

    const isEmail = val.includes("@");
    const isPhone = !isEmail && /\d{7,}/.test(val);

    rankedCandidates.push({
      claimId: c.id,
      rawValue: c.rawValue,
      normalizedValue: val,
      isEmail,
      isPhone,
      score: evalResult.score,
      contactType: evalResult.contactType,
      selectionReason: evalResult.reason,
      sourceDocumentId: c.sourceDocumentId,
    });
  }

  // Sort candidates by score descending
  rankedCandidates.sort((a, b) => b.score - a.score);

  // Top candidate = Primary RFQ Contact
  const primary: RankedContactCandidate | null = rankedCandidates.length > 0 ? (rankedCandidates[0] ?? null) : null;

  // Next up to 2 candidates = Backup RFQ Contacts
  const backups = rankedCandidates.slice(1, 3);

  const allSelected = rankedCandidates.slice(0, 3);

  // Candidates beyond top 3 are unselected (demoted) but kept as raw evidence
  for (let i = 3; i < rankedCandidates.length; i++) {
    const candidate = rankedCandidates[i];
    if (candidate && candidate.claimId) {
      demotedClaimIds.push(candidate.claimId);
    }
  }

  return {
    primary,
    backups,
    allSelected,
    rejectedClaimIds,
    demotedClaimIds,
    ambiguousClaimIds,
  };
}

/**
 * Applies the RFQ contact selection layer to a specific supplier company, materializing
 * at most 3 contacts (1 Primary, 0-2 Backups) into db.contact while preserving raw claims.
 */
export async function applySupplierRfqContactSelection(supplierCompanyId: string): Promise<SupplierRfqSelectionResult | null> {
  const supplier = await db.supplierCompany.findUnique({
    where: { id: supplierCompanyId },
    select: { id: true, normalizedDomain: true, websiteUrl: true },
  });

  if (!supplier) return null;

  const domain = supplier.normalizedDomain || supplier.websiteUrl;

  const claims = await db.extractedClaim.findMany({
    where: {
      supplierCompanyId,
      claimType: { in: ["CONTACT", "CONTACT_EMAIL", "CONTACT_PHONE"] },
    },
    select: {
      id: true,
      claimType: true,
      rawValue: true,
      normalizedValue: true,
      evidenceText: true,
      sourceDocumentId: true,
      reviewState: true,
      reviewedByUserId: true,
    },
  });

  const selection = selectRfqContactsFromClaims(claims, domain);

  // Clear existing materialized contacts for this supplier
  await db.contact.deleteMany({
    where: { supplierCompanyId },
  });

  // Materialize Primary and Backup contacts into db.contact
  for (let i = 0; i < selection.allSelected.length; i++) {
    const candidate = selection.allSelected[i];
    if (!candidate) continue;

    const isPrimary = i === 0;
    const nameLabel = isPrimary ? "Primary RFQ Contact" : `Backup RFQ Contact ${i}`;

    let email: string | null = null;
    let phone: string | null = null;

    if (candidate.isEmail) {
      email = candidate.normalizedValue;
    } else if (candidate.isPhone) {
      phone = candidate.normalizedValue;
    }

    await db.contact.create({
      data: {
        supplierCompanyId,
        name: nameLabel,
        publicBusinessEmail: email,
        normalizedEmail: email,
        publicBusinessPhone: phone,
        contactType: candidate.contactType,
        provenanceType: ProvenanceTypeEnum.PUBLICLY_DISCOVERED,
        verificationState: VerificationStateEnum.AUTO_APPROVED,
        sourceDocumentId: candidate.sourceDocumentId || null,
      },
    });
  }

  // Update rejected/excluded claims in ExtractedClaim to AUTO_REJECTED (if unreviewed by human)
  if (selection.rejectedClaimIds.length > 0) {
    await db.extractedClaim.updateMany({
      where: {
        id: { in: selection.rejectedClaimIds },
        reviewedByUserId: null,
      },
      data: {
        reviewState: "AUTO_REJECTED",
        validationDecision: "REJECT",
        validationRisk: "LOW",
        validationReason: "Excluded: not a usable RFQ contact (department, domain or format)",
        validationActor: "RULE_ENGINE:RFQ_CONTACT_SELECTION",
      },
    });
  }

  if (selection.demotedClaimIds.length > 0) {
    await db.extractedClaim.updateMany({
      where: {
        id: { in: selection.demotedClaimIds },
        reviewedByUserId: null,
      },
      data: {
        reviewState: "AUTO_REJECTED",
        validationDecision: "REJECT",
        validationRisk: "LOW",
        validationReason: "Valid contact, but ranked below the three chosen RFQ contacts",
        validationActor: "RULE_ENGINE:RFQ_CONTACT_SELECTION",
      },
    });
  }

  // Update selected claims in ExtractedClaim to AUTO_APPROVED
  const selectedClaimIds = selection.allSelected.map((c) => c.claimId).filter((id): id is string => Boolean(id));
  if (selectedClaimIds.length > 0) {
    await db.extractedClaim.updateMany({
      where: {
        id: { in: selectedClaimIds },
        reviewedByUserId: null,
      },
      data: {
        reviewState: "AUTO_APPROVED",
        validationDecision: "APPROVE",
        validationRisk: "LOW",
        validationReason: "Selected as primary or backup RFQ contact",
        validationActor: "RULE_ENGINE:RFQ_CONTACT_SELECTION",
      },
    });
  }

  return selection;
}
