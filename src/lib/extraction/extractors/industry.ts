import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";
import { db } from "@/lib/db";

const FALLBACK_INDUSTRIES = [
  { id: "ind_mfg", canonicalName: "Industrial Manufacturing", slug: "industrial-manufacturing" },
  { id: "ind_marine", canonicalName: "Marine & Shipbuilding", slug: "marine-shipbuilding" },
  { id: "ind_mining", canonicalName: "Mining & Metals", slug: "mining-metals" },
  { id: "ind_power", canonicalName: "Power & Utilities", slug: "power-utilities" },
  { id: "ind_const", canonicalName: "Commercial Construction", slug: "commercial-construction" },
];

export class IndustryExtractor implements BaseExtractor {
  public name = "INDUSTRY_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];

    let industries = FALLBACK_INDUSTRIES;
    if (process.env.NODE_ENV !== "test") {
      try {
        const dbInds = await db.industry.findMany({ where: { active: true } });
        if (dbInds.length > 0) industries = dbInds;
      } catch {
        // Fallback
      }
    }

    const sentences = input.visibleText.split(/(?<=[.!?])\s+/);
    const seenIndustryIds = new Set<string>();

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      for (const ind of industries) {
        if (seenIndustryIds.has(ind.id)) continue;

        if (lowerSentence.includes(ind.canonicalName.toLowerCase())) {
          seenIndustryIds.add(ind.id);
          claims.push({
            claimType: "INDUSTRY",
            rawValue: ind.canonicalName,
            normalizedValue: ind.slug,
            evidenceText: `Matched in sentence: "${sentence.trim()}"`,
            evidenceLocator: "body_text",
            extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
            confidence: 0.85,
            entityId: ind.id,
          });
        }
      }
    }

    return claims;
  }
}
