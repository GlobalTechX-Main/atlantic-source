import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";
import { db } from "@/lib/db";
import { findFlexiblePhrase, splitIntoUnits, snippetAround } from "../text";

const FALLBACK_INDUSTRIES = [
  { id: "ind_mfg", canonicalName: "Industrial Manufacturing", slug: "industrial-manufacturing" },
  { id: "ind_marine", canonicalName: "Marine & Shipbuilding", slug: "marine-shipbuilding" },
  { id: "ind_mining", canonicalName: "Mining & Metals", slug: "mining-metals" },
  { id: "ind_power", canonicalName: "Power & Utilities", slug: "power-utilities" },
  { id: "ind_const", canonicalName: "Commercial Construction", slug: "commercial-construction" },
  { id: "ind_forest", canonicalName: "Forestry & Pulp/Paper", slug: "forestry-pulp-paper" },
];

/** Other wording for each industry, matched as whole phrases. */
const INDUSTRY_ALIASES: Record<string, string[]> = {
  "industrial-manufacturing": ["manufacturing industry", "manufacturing plants", "manufacturing sector"],
  "marine-shipbuilding": ["shipbuilding", "shipyards", "shipyard", "marine industry", "marine sector", "offshore"],
  "mining-metals": ["mining", "mines", "metals industry"],
  "power-utilities": ["power generation", "utilities", "power plants", "nuclear", "hydroelectric", "wind energy"],
  "commercial-construction": ["commercial construction", "institutional construction", "general contractors"],
  "forestry-pulp-paper": ["pulp and paper", "pulp & paper", "pulp mills", "paper mills", "forestry", "sawmills"],
};

/** Sentences that talk about who the company serves. */
const INDUSTRY_CONTEXT = /\b(?:industr(?:y|ies)|sectors?|markets?|serv(?:e|es|ed|ing)|clients?|customers?|experience\s+in|work(?:ed)?\s+(?:in|with|for))\b/i;

export class IndustryExtractor implements BaseExtractor {
  public name = "INDUSTRY_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    let industries: { id: string; canonicalName: string; slug: string }[] = FALLBACK_INDUSTRIES;
    if (process.env.NODE_ENV !== "test") {
      try {
        const dbInds = await db.industry.findMany({ where: { active: true } });
        if (dbInds.length > 0) industries = dbInds;
      } catch {
        // Fallback
      }
    }

    const isIndustryPage = input.pageType === "INDUSTRIES" || /\/industr/i.test(input.sourceUrl);
    const units = [
      ...(input.headings || []).map((h) => h.text),
      ...splitIntoUnits(input.contentText ?? input.visibleText),
    ];

    const best = new Map<string, ExtractedClaimCandidate>();
    for (const unit of units) {
      const inContext = isIndustryPage || INDUSTRY_CONTEXT.test(unit);
      for (const ind of industries) {
        const phrases = [ind.canonicalName, ...(INDUSTRY_ALIASES[ind.slug] || [])];
        for (const phrase of phrases) {
          const m = findFlexiblePhrase(unit, phrase)[0];
          if (!m) continue;
          const confidence = phrase === ind.canonicalName ? (inContext ? 0.9 : 0.75) : inContext ? 0.82 : 0.6;
          const prev = best.get(ind.slug);
          if (prev && prev.confidence >= confidence) continue;
          best.set(ind.slug, {
            claimType: "INDUSTRY",
            rawValue: ind.canonicalName,
            normalizedValue: ind.slug,
            evidenceText: `Matched "${phrase}" in sentence: "${unit.length > 300 ? snippetAround(unit, m.index, m.length, 140) : unit}"`,
            evidenceLocator: isIndustryPage ? "industries_page" : "body_text",
            extractionMethod: phrase === ind.canonicalName ? ExtractionMethodEnum.TAXONOMY_EXACT : ExtractionMethodEnum.TAXONOMY_ALIAS,
            confidence,
            entityId: ind.id,
          });
        }
      }
    }
    return Array.from(best.values());
  }
}
