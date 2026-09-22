import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";

const SERVICE_COVERAGE_PATTERNS = [
  /serv(?:ing|ices?)\s+(?:all\s+of\s+)?([A-Za-z\s,]+)/i,
  /coverage\s+throughout\s+([A-Za-z\s,]+)/i,
  /operat(?:ing|es?)\s+across\s+([A-Za-z\s,]+)/i,
  /across\s+([A-Za-z\s,]+)/i,
];

const KNOWN_REGIONS = [
  { name: "New Brunswick", slug: "new-brunswick" },
  { name: "Nova Scotia", slug: "nova-scotia" },
  { name: "Prince Edward Island", slug: "pei" },
  { name: "PEI", slug: "pei" },
  { name: "Atlantic Canada", slug: "atlantic-canada" },
  { name: "Fredericton", slug: "fredericton" },
  { name: "Saint John", slug: "saint-john" },
  { name: "Moncton", slug: "moncton" },
];

export class ServiceRegionExtractor implements BaseExtractor {
  public name = "SERVICE_REGION_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];
    const sentences = input.visibleText.split(/(?<=[.!?])\s+/);
    const seenRegionSlugs = new Set<string>();

    for (const sentence of sentences) {
      for (const pattern of SERVICE_COVERAGE_PATTERNS) {
        const match = sentence.match(pattern);
        if (match) {
          const matchedText = sentence.trim();
          for (const region of KNOWN_REGIONS) {
            if (seenRegionSlugs.has(region.slug)) continue;

            if (matchedText.toLowerCase().includes(region.name.toLowerCase())) {
              seenRegionSlugs.add(region.slug);
              claims.push({
                claimType: "SERVICE_REGION",
                rawValue: region.name,
                normalizedValue: region.slug,
                evidenceText: `Explicit service coverage statement: "${matchedText}"`,
                evidenceLocator: "body_text",
                extractionMethod: ExtractionMethodEnum.TAXONOMY_PHRASE,
                confidence: 0.9,
              });
            }
          }
        }
      }
    }

    return claims;
  }
}
