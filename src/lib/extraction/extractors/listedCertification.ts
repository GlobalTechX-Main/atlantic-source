import { ExtractionMethodEnum } from "@prisma/client";
import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";

/** The company's own certifications / quality / affiliations page. */
const CERT_PAGE_URL = /certif|affiliation|accreditation|approvals|quality|memberships?|standards|compliance/i;

/** A standard or certificate code: "UL 10C", "NFPA 80", "CAN/ULC S104-10", "ANSI / NAAMM / HMMA 861", "AS9100D". */
const STANDARD = /\b[A-Z]{2,}(?:\s*\/\s*[A-Z]{2,})*[\s\-/]*[A-Z]?\d[\w.\-:/()]*/;
/** An association or certifying body: "Door and Hardware Institute (DHI)". */
const BODY = /\b(?:Association|Institute|Council|Bureau|Society|Alliance|Federation|Chamber|Board|Agency)\b/;
const NOT_A_STANDARD = /\b(?:\d{3}[-.\s]\d{3}[-.\s]\d{4}|[A-Z]\d[A-Z]\s?\d[A-Z]\d|copyright|©|all rights|suite|street|avenue|road)\b/i;

function clean(line: string): string {
  return line.replace(/^[\s•·\-–—*]+/, "").replace(/\s+/g, " ").trim();
}

/**
 * Standards, certificates and memberships as the company lists them on its own
 * certifications page. These never publish on their own: a person checks them first.
 */
export class ListedCertificationExtractor implements BaseExtractor {
  public name = "LISTED_CERTIFICATION_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    let path = "";
    try {
      path = new URL(input.sourceUrl).pathname;
    } catch {
      return [];
    }
    if (input.pageType !== "CERTIFICATIONS" && !CERT_PAGE_URL.test(path)) return [];

    const lines = [...(input.contentText ?? input.visibleText).split("\n"), ...input.headings.map((h) => h.text)];
    const out = new Map<string, ExtractedClaimCandidate>();
    for (const raw of lines) {
      const line = clean(raw);
      const words = line.split(" ").length;
      if (line.length < 3 || line.length > 90 || words > 12 || /[.!?]$/.test(line) || NOT_A_STANDARD.test(line)) continue;
      const isStandard = STANDARD.test(line) && !/^\d{4}$/.test(line);
      const isBody = BODY.test(line) && /^[A-Z]/.test(line);
      if (!isStandard && !isBody) continue;
      const key = line.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (out.has(key) || out.size >= 30) continue;
      out.set(key, {
        claimType: "CERTIFICATION_LISTED",
        rawValue: line,
        normalizedValue: key,
        evidenceText: `Listed on the company's certifications page ${input.sourceUrl}: "${line}"`,
        evidenceLocator: "CERTIFICATIONS_PAGE_LIST",
        extractionMethod: ExtractionMethodEnum.PAGE_STRUCTURE,
        confidence: 0.8,
      });
    }
    return [...out.values()];
  }
}
