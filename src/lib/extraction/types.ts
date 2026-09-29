import { ExtractionMethodEnum } from "@prisma/client";

export interface ExtractedClaimCandidate {
  claimType:
    | "CAPABILITY"
    | "INDUSTRY"
    | "CERTIFICATION"
    | "EQUIPMENT"
    | "LOCATION"
    | "SERVICE_REGION"
    | "CONTACT"
    /** A service named on the company's own site, in its own words ("Heavy Lift & Rigging"). */
    | "SERVICE_LISTED"
    /** A product line named on the company's own site ("Fire Rated Doors"). */
    | "PRODUCT_LISTED"
    /** A standard, certification or membership the company lists on its own site ("UL 10C", "DHI"). Always reviewed. */
    | "CERTIFICATION_LISTED"
    /** The company's own social media page (rawValue = URL). */
    | "SOCIAL"
    /** Opening hours as written on the site ("Monday – Friday: 8:00 AM – 5:00 PM"). */
    | "BUSINESS_HOURS";
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
  /** Web links on the page (menus and footer included) with their text. */
  links?: { href: string; text: string }[];
  /** Dropdown / mega-menu groups with the labels above them (see parser). */
  menuGroups?: { trail: string[]; links: { href: string; text: string }[] }[];
  /**
   * When this page is one of a set of sibling pages (/x/heavy-lift, /x/rigging, …) whose
   * content reads like services, products or projects, which one (see pipeline).
   */
  collectionKind?: "SERVICE" | "PRODUCT" | "PROJECT";
}

export interface BaseExtractor {
  name: string;
  extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]>;
}
