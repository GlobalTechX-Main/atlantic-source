export type ValidationDecision = "APPROVE" | "REJECT" | "HUMAN_REVIEW";
export type ValidationRisk = "LOW" | "MEDIUM" | "HIGH";

export interface ValidationInput {
  claimId?: string;
  supplierCompanyId: string;
  supplierName: string;
  supplierDomain?: string | null;
  claimType: "CAPABILITY" | "INDUSTRY" | "CERTIFICATION" | "EQUIPMENT" | "LOCATION" | "SERVICE_REGION" | "CONTACT" | string;
  rawValue: string;
  normalizedValue?: string | null;
  extractionMethod: string;
  extractionConfidence: number;
  pageType?: string | null;
  evidenceText: string;
  surroundingContext?: string | null;
  taxonomyItemName?: string | null;
  contentHash?: string | null;
}

export interface ValidationResult {
  decision: ValidationDecision;
  confidence: number; // 0.0 to 1.0
  risk: ValidationRisk;
  reason: string;
  evidenceSupported: boolean;
  validatorVersion: string;
  validatorActor: string;
  qaFlags?: string[];
}

export interface ClaimValidator {
  name: string;
  version: string;
  validateClaim(input: ValidationInput): Promise<ValidationResult>;
  validateBatch(inputs: ValidationInput[]): Promise<ValidationResult[]>;
}

export interface SupplierQAFlag {
  code: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
  affectedClaimIds?: string[];
}

export interface ProfileQAResult {
  supplierCompanyId: string;
  supplierName: string;
  hasInconsistencies: boolean;
  qaFlags: SupplierQAFlag[];
}
