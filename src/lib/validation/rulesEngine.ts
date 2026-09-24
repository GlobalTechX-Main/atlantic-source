import { ValidationInput, ValidationResult } from "./types";

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /system\s+prompt/i,
  /you\s+are\s+an?\s+ai/i,
  /approve\s+(all\s+)?claims/i,
  /grant\s+verified\s+status/i,
  /disregard\s+(all\s+)?rules/i,
  /override\s+decision/i,
];

const NEGATION_PATTERNS = [
  /do\s+not\s+(offer|provide|perform|manufacture|do)/i,
  /don'?t\s+(offer|provide|perform|manufacture|do)/i,
  /no\s+longer\s+(offer|provide|perform|manufacture|do)/i,
  /not\s+available/i,
  /we\s+do\s+not\s+do/i,
  /excluded\s+from\s+scope/i,
];

const THIRD_PARTY_PATTERNS = [
  /subcontracted(\s+to)?/i,
  /outsource[ds]?(\s+to)?/i,
  /partnered\s+with/i,
  /client\s+name/i,
  /on\s+behalf\s+of/i,
  /third-party/i,
  /partner\s+vendor/i,
  /our\s+partner\s+provides/i,
  /provided\s+by(\s+our)?\s+partner/i,
  /our\s+customer\s+required/i,
  /we\s+sourced/i,
  /project\s+included/i,
  /subcontractor/i,
  /vendor\s+supplied/i,
  /customer\s+supplied/i,
];



/**
 * Deterministic Rules Engine for Claim Validation.
 * Evaluates evidence-grounded claims against strict rules before falling back to model validation.
 */
export function evaluateDeterministicRules(input: ValidationInput): ValidationResult {
  const combinedText = `${input.evidenceText} ${input.surroundingContext || ""}`.trim();

  // 1. Safety Guard: Prompt Injection Defense
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(combinedText)) {
      return {
        decision: "HUMAN_REVIEW",
        confidence: 0.0,
        risk: "HIGH",
        reason: "Potential prompt injection or untrusted instruction pattern detected in source snippet",
        evidenceSupported: false,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:PROMPT_INJECTION_DEFENSE",
      };
    }
  }

  // 2. High-Risk Rule: Negated Capability
  // Only the claim's own evidence sentence counts: a negation elsewhere nearby
  // ("not available on weekends") says nothing about this fact.
  for (const pattern of NEGATION_PATTERNS) {
    if (pattern.test(input.evidenceText)) {
      return {
        decision: "REJECT",
        confidence: 0.95,
        risk: "LOW",
        reason: "Source text contains explicit negation wording for this capability",
        evidenceSupported: false,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:NEGATION_DETECTOR",
      };
    }
  }

  // 3. High-Risk Rule: Third-Party / Wrong-Company Mention
  for (const pattern of THIRD_PARTY_PATTERNS) {
    if (pattern.test(combinedText)) {
      return {
        decision: "HUMAN_REVIEW",
        confidence: 0.7,
        risk: "HIGH",
        reason: "Evidence references third-party vendor, partner, customer requirement, or subcontracted service attribution",
        evidenceSupported: true,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:THIRD_PARTY_DETECTOR",
      };
    }
  }

  // 3b. Clearly weak certification text: an organisation merely mentioned ("works with the
  // Canadian Welding Bureau"), or a statement that others hold it / it is still in progress.
  if (input.claimType === "CERTIFICATION" && (input.normalizedValue === "cwb-organization" || input.extractionConfidence < 0.65)) {
    return {
      decision: "REJECT",
      confidence: 0.85,
      risk: "LOW",
      reason: "Not a statement that the company holds this certification (organisation mention, in progress, or held by others)",
      evidenceSupported: false,
      validatorVersion: "1.2.0",
      validatorActor: "RULE_ENGINE:WEAK_CERTIFICATION_MENTION",
    };
  }

  // 4. High-Risk Rule: Certification Safeguard
  // Certifications can NEVER be marked AtlanticSource Verified automatically.
  // They require human review before verification or publishing.
  if (input.claimType === "CERTIFICATION") {
    return {
      decision: "HUMAN_REVIEW",
      confidence: 0.85,
      risk: "MEDIUM",
      reason: "Certification mentions require human document review before verification",
      evidenceSupported: true,
      validatorVersion: "1.0.0",
      validatorActor: "RULE_ENGINE:CERTIFICATION_SAFEGUARD",
    };
  }

  // 5. High-Risk Rule: Company Claim / Ownership Disputes
  if (input.claimType === "COMPANY_OWNERSHIP" || input.claimType === "CLAIM_REQUEST") {
    return {
      decision: "HUMAN_REVIEW",
      confidence: 0.9,
      risk: "HIGH",
      reason: "Company ownership and business claim requests must remain human-controlled",
      evidenceSupported: true,
      validatorVersion: "1.0.0",
      validatorActor: "RULE_ENGINE:OWNERSHIP_SAFEGUARD",
    };
  }

  // 6. Strict RFQ Contact Quality & Auto-Approval Rule (Email & Phone)
  if (
    input.claimType === "CONTACT" ||
    input.claimType === "CONTACT_EMAIL" ||
    input.claimType === "CONTACT_PHONE"
  ) {
    if (input.rawValue.includes("@")) {
      const rawLower = input.rawValue.toLowerCase().trim();
      const parts = rawLower.split("@");
      const localPart = parts[0] || "";
      const emailDomain = parts[1] || "";

      // 6a. Malformed / Concatenated Email Safeguard
      const isDirtyEmail =
        localPart.startsWith("email") ||
        rawLower.endsWith("phone") ||
        rawLower.endsWith("fax") ||
        rawLower.endsWith("tel") ||
        emailDomain.includes("..") ||
        emailDomain.split(".").length > 3 ||
        !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|ca|org|net|edu|gov|io|co|biz|info)$/i.test(rawLower);

      if (isDirtyEmail) {
        return {
          decision: "HUMAN_REVIEW",
          confidence: 0.5,
          risk: "MEDIUM",
          reason: "Contact email string contains format anomalies or extraction artifacts",
          evidenceSupported: true,
          validatorVersion: "1.0.0",
          validatorActor: "RULE_ENGINE:DIRTY_EMAIL_SAFEGUARD",
        };
      }

      // 6b. Non-RFQ Email Prefixes / Department Keywords -> REJECT
      const NON_RFQ_KEYWORDS = [
        "hr", "careers", "recruiting", "jobs", "employment", "hiring", "workwithus",
        "peopleservices", "humanresources", "ukiexternalpeopleservices", "hr.middleeast",
        "media", "press", "pr", "communications",
        "privacy", "legal", "compliance", "gdpr",
        "investors", "investorrelations", "ir", "aecominvestorrelations",
        "payroll", "retirement", "retirementplans", "aphelpdesk", "accountspayable",
        "corporateresponsibility", "webmaster", "postmaster"
      ];

      // Compare whole parts of the address ("hr.team" -> ["hr", "team"]), never substrings:
      // "pr" must not match "procurement" and "hr" must not match "chris".
      const localTokens = localPart.split(/[._+-]+/).filter(Boolean);
      const isNonRFQ = NON_RFQ_KEYWORDS.some((kw) =>
        localPart === kw || localTokens.includes(kw) || (kw.length >= 5 && localTokens.some((t) => t.startsWith(kw)))
      );

      if (isNonRFQ) {
        return {
          decision: "REJECT",
          confidence: 0.95,
          risk: "LOW",
          reason: "Non-RFQ contact (HR, media, legal, investor relations, internal admin, or payroll excluded from RFQ outreach)",
          evidenceSupported: true,
          validatorVersion: "1.0.0",
          validatorActor: "RULE_ENGINE:EXCLUDE_NON_RFQ_CONTACT",
        };
      }

      // 6c. Non-Atlantic / Foreign Regional Hubs or Third-Party Domains -> REJECT
      const FOREIGN_HUB_PREFIXES = ["businessinquiry.anz", "businessinquiry.sea", "businessinquiry.gc", "businessinquiry.emia"];
      if (FOREIGN_HUB_PREFIXES.some((p) => localPart.includes(p)) || emailDomain.includes("gssdubai") || emailDomain.split(".").length > 2 && emailDomain.endsWith(".aecom.com")) {
        return {
          decision: "REJECT",
          confidence: 0.9,
          risk: "LOW",
          reason: "Global/foreign office or third-party contact outside Atlantic Canadian sourcing scope",
          evidenceSupported: true,
          validatorVersion: "1.0.0",
          validatorActor: "RULE_ENGINE:EXCLUDE_FOREIGN_HUB",
        };
      }

      // 6d. Role-Based RFQ Email Prefixes (sales@, info@, estimating@, quotes@, rfq@, procurement@, businessdevelopment@, etc.)
      const ALLOWED_RFQ_PREFIXES = [
        "sales", "info", "estimating", "quotes", "rfq", "procurement",
        "businessdevelopment", "bizdev", "contact", "inquiries", "inquiry",
        "orders", "dispatch", "general", "commercial", "projects", "office",
        "admin", "frontdesk", "help", "general.inquiries", "businessinquiry.americas"
      ];

      const isRoleRFQ = ALLOWED_RFQ_PREFIXES.some((prefix) =>
        localPart === prefix || localPart.startsWith(`${prefix}.`) || localPart.startsWith(`${prefix}_`)
      );

      if (isRoleRFQ) {
        return {
          decision: "APPROVE",
          confidence: 0.98,
          risk: "LOW",
          reason: "Explicit role-based RFQ procurement contact email",
          evidenceSupported: true,
          validatorVersion: "1.0.0",
          validatorActor: "RULE_ENGINE:ROLE_RFQ_EMAIL",
        };
      }

      // 6e. Supplier-Domain Employee Email Validation
      const supplierDomain = input.supplierDomain?.toLowerCase().replace(/^www\./, "");
      const cleanEmailDomain = emailDomain.toLowerCase().replace(/^www\./, "");

      const isDomainMatch = supplierDomain && (cleanEmailDomain === supplierDomain || cleanEmailDomain.endsWith(`.${supplierDomain}`));

      if (isDomainMatch) {
        const lowerContext = `${input.evidenceText} ${input.surroundingContext || ""} ${input.pageType || ""}`.toLowerCase();
        const hasCommercialContext =
          lowerContext.includes("sales") ||
          lowerContext.includes("estimating") ||
          lowerContext.includes("commercial") ||
          lowerContext.includes("operations") ||
          lowerContext.includes("contact") ||
          lowerContext.includes("services") ||
          lowerContext.includes("engineering") ||
          lowerContext.includes("branch") ||
          lowerContext.includes("fabrication") ||
          lowerContext.includes("shop") ||
          lowerContext.includes("manager") ||
          lowerContext.includes("dispatch") ||
          input.pageType === "CONTACT" ||
          input.pageType === "SERVICES";

        if (hasCommercialContext) {
          return {
            decision: "APPROVE",
            confidence: 0.92,
            risk: "LOW",
            reason: "Supplier-domain commercial/sales contact email supported by page context",
            evidenceSupported: true,
            validatorVersion: "1.0.0",
            validatorActor: "RULE_ENGINE:SUPPLIER_DOMAIN_EMPLOYEE_EMAIL",
          };
        } else {
          return {
            decision: "HUMAN_REVIEW",
            confidence: 0.6,
            risk: "MEDIUM",
            reason: "Supplier-domain employee email lacks explicit commercial/RFQ page context",
            evidenceSupported: true,
            validatorVersion: "1.0.0",
            validatorActor: "RULE_ENGINE:EMPLOYEE_EMAIL_CONTEXT_CHECK",
          };
        }
      }

      // Third-party domain email
      return {
        decision: "HUMAN_REVIEW",
        confidence: 0.5,
        risk: "HIGH",
        reason: "Contact email domain does not match supplier domain",
        evidenceSupported: true,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:THIRD_PARTY_EMAIL_SAFEGUARD",
      };
    }

    // 6f. Usable Supplier Phone Numbers
    const phoneDigits = input.rawValue.replace(/\D/g, "");
    if (phoneDigits.length >= 10 && phoneDigits.length <= 11) {
      // Whole words only: "hr" must not match "three" or "through", "media" not "immediately".
      const isNonRFQPhone = /\b(?:payroll|retirement|helpdesk|help\s+desk|hr|human\s+resources|investors?|investor\s+relations|media\s+(?:inquiries|relations|contact))\b/i.test(
        input.evidenceText
      );

      if (isNonRFQPhone) {
        return {
          decision: "REJECT",
          confidence: 0.9,
          risk: "LOW",
          reason: "Phone number associated with HR, benefits, or internal helpdesk",
          evidenceSupported: true,
          validatorVersion: "1.0.0",
          validatorActor: "RULE_ENGINE:EXCLUDE_NON_RFQ_PHONE",
        };
      }

      return {
        decision: "APPROVE",
        confidence: 0.95,
        risk: "LOW",
        reason: "Explicit 10-digit supplier business phone number",
        evidenceSupported: true,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:EXPLICIT_PHONE_FACT",
      };
    }
  }

  // 7. Deterministic Auto-Approval: Exact Taxonomy Capability Match
  // Very weak matches are rejected outright so they never reach the review queue: the
  // extractor scores a term this low when it only describes customers served, appears in a
  // bio or explainer, or (for industries) is a passing mention with no "industries we serve" context.
  const rejectBelow: Record<string, number> = { CAPABILITY: 0.5, EQUIPMENT: 0.5, INDUSTRY: 0.65 };
  const threshold = rejectBelow[input.claimType];
  if (threshold !== undefined && input.extractionConfidence < threshold && input.extractionMethod !== "TAXONOMY_PHRASE") {
    return {
      decision: "REJECT",
      confidence: 0.85,
      risk: "LOW",
      reason: "Term appears only in passing (customers served, biography, explainer or unrelated mention), not as work the company does",
      evidenceSupported: false,
      validatorVersion: "1.2.0",
      validatorActor: "RULE_ENGINE:WEAK_MENTION_REJECT",
    };
  }

  if (
    (input.claimType === "CAPABILITY" || input.claimType === "INDUSTRY" || input.claimType === "EQUIPMENT") &&
    input.extractionConfidence < 0.8
  ) {
    // Extractors lower confidence when a term is only sold, only describes customers,
    // is part of a job title or sits in a project description.
    return {
      decision: "HUMAN_REVIEW",
      confidence: input.extractionConfidence,
      risk: "MEDIUM",
      reason: "Term found in a weaker context (resale, customers served, job title or project description); needs a person to confirm",
      evidenceSupported: true,
      validatorVersion: "1.1.0",
      validatorActor: "RULE_ENGINE:WEAK_CONTEXT_MATCH",
    };
  }

  if (
    (input.claimType === "CAPABILITY" || input.claimType === "INDUSTRY" || input.claimType === "EQUIPMENT") &&
    (input.extractionMethod === "TAXONOMY_EXACT" || input.extractionMethod === "TAXONOMY_ALIAS")
  ) {
    return {
      decision: "APPROVE",
      confidence: 0.95,
      risk: "LOW",
      reason: "Exact taxonomy capability/industry match extracted from supplier source page with verified first-party language",
      evidenceSupported: true,
      validatorVersion: "1.0.0",
      validatorActor: "RULE_ENGINE:EXACT_TAXONOMY_CAPABILITY",
    };
  }

  // 8a. Deterministic Validation: Physical Location / Street Address
  if (input.claimType === "LOCATION") {
    const isProjectLocation =
      combinedText.includes("Role: PROJECT_OR_CLIENT_LOCATION") ||
      combinedText.toLowerCase().includes("project location");
    if (isProjectLocation) {
      return {
        decision: "REJECT",
        confidence: 0.95,
        risk: "LOW",
        reason: "Project or client location reference; excluded from physical supplier location records",
        evidenceSupported: true,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:EXCLUDE_PROJECT_LOCATION",
      };
    }

    if (combinedText.includes("Role: OUT_OF_REGION")) {
      return {
        decision: "HUMAN_REVIEW",
        confidence: 0.6,
        risk: "MEDIUM",
        reason: "Address is outside Atlantic Canada; confirm the supplier really operates in the region",
        evidenceSupported: true,
        validatorVersion: "1.1.0",
        validatorActor: "RULE_ENGINE:OUT_OF_REGION_LOCATION",
      };
    }

    const isUnknownRole = combinedText.includes("Role: UNKNOWN");
    if (isUnknownRole) {
      return {
        decision: "HUMAN_REVIEW",
        confidence: 0.6,
        risk: "MEDIUM",
        reason: "Location role could not be conclusively determined from surrounding evidence",
        evidenceSupported: true,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:UNKNOWN_LOCATION_ROLE",
      };
    }

    if (input.rawValue && input.rawValue.trim().length > 2) {
      return {
        decision: "APPROVE",
        confidence: 0.92,
        risk: "LOW",
        reason: "Explicit physical supplier location fact matched in source snippet",
        evidenceSupported: true,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:EXPLICIT_LOCATION_FACT",
      };
    }
  }

  // 8b. Deterministic Auto-Approval: Explicit Service Region Coverage
  if (input.claimType === "SERVICE_REGION") {
    const lowerEv = combinedText.toLowerCase();
    const hasCoveragePhrasing =
      lowerEv.includes("serving") ||
      lowerEv.includes("serve") ||
      lowerEv.includes("serves") ||
      lowerEv.includes("service area") ||
      lowerEv.includes("coverage") ||
      lowerEv.includes("operations in") ||
      lowerEv.includes("services across") ||
      lowerEv.includes("across") ||
      lowerEv.includes("throughout") ||
      lowerEv.includes("servicing") ||
      lowerEv.includes("located in") ||
      lowerEv.includes("serving atlantic canada") ||
      lowerEv.includes("serving new brunswick");

    if (!hasCoveragePhrasing) {
      return {
        decision: "HUMAN_REVIEW",
        confidence: 0.6,
        risk: "MEDIUM",
        reason: "Service region mention lacks explicit service coverage phrasing",
        evidenceSupported: true,
        validatorVersion: "1.0.0",
        validatorActor: "RULE_ENGINE:SERVICE_REGION_COVERAGE_CHECK",
      };
    }

    return {
      decision: "APPROVE",
      confidence: 0.9,
      risk: "LOW",
      reason: "Explicit regional service coverage statement matched in source snippet",
      evidenceSupported: true,
      validatorVersion: "1.0.0",
      validatorActor: "RULE_ENGINE:EXPLICIT_SERVICE_REGION",
    };
  }

  // 9. Default Fallback: Ambiguous / Low-Confidence Claims require human review
  return {
    decision: "HUMAN_REVIEW",
    confidence: 0.6,
    risk: "MEDIUM",
    reason: "Claim requires human review by platform admin",
    evidenceSupported: true,
    validatorVersion: "1.0.0",
    validatorActor: "RULE_ENGINE:FALLBACK_HEURISTIC",
  };
}
