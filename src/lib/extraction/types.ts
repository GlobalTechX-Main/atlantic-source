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
  /**
   * Main page content only, one block per line: menus, headers, footers and text that
   * repeats on every page of the site are removed. Used for service, certification,
   * industry, equipment and region facts. Falls back to `visibleText` when absent.
   */
  contentText?: string;
  /**
   * Whole page text including header and footer, one block per line. Used for
   * addresses and contact details, which usually live in the footer.
   */
  fullText?: string;
  /** Alt text of meaningful images in the main content (e.g. certification logos). */
  imageAlts?: string[];
  /**
   * True when the site as a whole looks like a shop or distributor (cart, "shop by
   * category"). Service words there usually name product categories, so capability
   * facts are sent to review instead of being approved.
   */
  siteIsRetail?: boolean;
  /** Page classification from link discovery (HOME, SERVICES, CONTACT, ...). */
  pageType?: string;
}

export interface BaseExtractor {
  name: string;
  extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]>;
}
