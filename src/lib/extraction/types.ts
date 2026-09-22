import { ExtractionMethodEnum } from "@prisma/client";

export interface ExtractedClaimCandidate {
  claimType: "CAPABILITY" | "INDUSTRY" | "CERTIFICATION" | "EQUIPMENT" | "LOCATION" | "SERVICE_REGION" | "CONTACT";
  rawValue: string;
  normalizedValue?: string;
  evidenceText: string;
  evidenceLocator?: string; // CSS selector / XPath / Heading context
  extractionMethod: ExtractionMethodEnum;
  confidence: number; // 0.0 to 1.0
  entityId?: string; // Optional capabilityId, industryId, etc.
}

export interface ExtractorInput {
  sourceDocumentId: string;
  supplierCompanyId: string;
  sourceUrl: string;
  pageTitle: string;
  visibleText: string;
  headings: { level: string; text: string }[];
  jsonLdScripts: string[];
  mailtoLinks: string[];
  telLinks: string[];
  canonicalUrl: string;
}

export interface BaseExtractor {
  name: string;
  extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]>;
}
