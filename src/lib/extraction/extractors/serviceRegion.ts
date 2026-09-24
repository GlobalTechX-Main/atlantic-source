import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";
import { splitIntoUnits, snippetAround } from "../text";

/**
 * A coverage statement is a verb or phrase that says where the company works, followed
 * closely by the place. The noun "Services" (as in a menu link) is deliberately not a
 * coverage cue.
 */
const COVERAGE_CUE =
  /\b(?:serv(?:e|es|ed|ing)|servicing|provid(?:e|es|ing)\s+(?:services?\s+)?(?:to|in|across|throughout)|operat(?:e|es|ing)\s+(?:across|throughout|in)|coverage\s+(?:across|throughout|of|in)|service\s+area|clients?\s+(?:across|throughout)|customers?\s+(?:across|throughout)|throughout|across)\b/gi;

/** Region names as whole words; "Saint John" must not match "Saint John's" (Newfoundland). */
const KNOWN_REGIONS: { name: string; slug: string; pattern: RegExp }[] = [
  { name: "Atlantic Canada", slug: "atlantic-canada", pattern: /\b(?:Atlantic\s+Canada|Atlantic\s+Provinces|Maritimes|Maritime\s+Provinces)\b/i },
  { name: "New Brunswick", slug: "new-brunswick", pattern: /\bNew\s+Brunswick\b/i },
  { name: "Nova Scotia", slug: "nova-scotia", pattern: /\bNova\s+Scotia\b/i },
  { name: "Prince Edward Island", slug: "pei", pattern: /\b(?:Prince\s+Edward\s+Island|P\.?E\.?I\.?)(?![A-Za-z])/ },
  { name: "Fredericton", slug: "fredericton", pattern: /\bFredericton\b/i },
  { name: "Saint John", slug: "saint-john", pattern: /\bSaint\s+John\b(?!['’]s)/i },
  { name: "Moncton", slug: "moncton", pattern: /\bMoncton\b/i },
];

/** How far after the cue the region may appear (roughly one clause). */
const WINDOW = 90;

export class ServiceRegionExtractor implements BaseExtractor {
  public name = "SERVICE_REGION_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];
    const seen = new Set<string>();

    for (const unit of splitIntoUnits(input.contentText ?? input.visibleText)) {
      COVERAGE_CUE.lastIndex = 0;
      let cue: RegExpExecArray | null;
      while ((cue = COVERAGE_CUE.exec(unit)) !== null) {
        const clauseEnd = unit.slice(cue.index + cue[0].length).search(/[.;!?\n]/);
        const limit = clauseEnd === -1 ? WINDOW : Math.min(WINDOW, clauseEnd);
        const window = unit.slice(cue.index + cue[0].length, cue.index + cue[0].length + limit);

        for (const region of KNOWN_REGIONS) {
          if (seen.has(region.slug)) continue;
          const m = region.pattern.exec(window);
          if (!m) continue;
          seen.add(region.slug);
          const statement = unit.length > 300 ? snippetAround(unit, cue.index, cue[0].length + m.index + m[0].length, 100) : unit;
          claims.push({
            claimType: "SERVICE_REGION",
            rawValue: region.name,
            normalizedValue: region.slug,
            evidenceText: `Explicit service coverage statement: "${statement}"`,
            evidenceLocator: "body_text",
            extractionMethod: ExtractionMethodEnum.TAXONOMY_PHRASE,
            confidence: 0.9,
          });
        }
      }
    }

    return claims;
  }
}
