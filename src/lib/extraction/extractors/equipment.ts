import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";
import { db } from "@/lib/db";
import { findPhrase, splitIntoUnits, snippetAround, classifyMatchContext } from "../text";

const FALLBACK_EQUIPMENT = [
  { id: "eq_cnc_mill", canonicalName: "CNC Milling Machine", slug: "cnc-mill" },
  { id: "eq_brake_press", canonicalName: "Hydraulic Press Brake", slug: "hydraulic-press-brake" },
  { id: "eq_plasma", canonicalName: "CNC Plasma Cutting Table", slug: "cnc-plasma-cutter" },
  { id: "eq_lathe", canonicalName: "Industrial Lathe", slug: "industrial-lathe" },
];

/** Common ways shops list the same machines on their equipment pages. */
const EQUIPMENT_ALIASES: Record<string, string[]> = {
  "cnc-mill": ["CNC mill", "CNC mills", "CNC milling", "vertical machining center", "horizontal machining center"],
  "hydraulic-press-brake": ["press brake", "press brakes"],
  "cnc-plasma-cutter": ["plasma table", "plasma cutting table", "CNC plasma", "plasma cutter"],
  "industrial-lathe": ["CNC lathe", "CNC lathes", "engine lathe", "lathes"],
};

/** Wording that says the shop owns or runs the machine, or gives its size. */
const OWNERSHIP_CUE =
  /\b(?:we\s+(?:have|own|operate|run|use)|our\s+(?:shop|facility|fleet|equipment|machines?)|equipped\s+with|capable\s+of|in-house|\d+\s*(?:ton|tons|t|ft|foot|feet|mm|in|inch|"|′|’|x)\b|capacity)\b/i;

export class EquipmentExtractor implements BaseExtractor {
  public name = "EQUIPMENT_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    let equipmentTypes: { id: string; canonicalName: string; slug: string }[] = FALLBACK_EQUIPMENT;
    if (process.env.NODE_ENV !== "test") {
      try {
        const dbEqs = await db.equipmentType.findMany({ where: { active: true } });
        if (dbEqs.length > 0) equipmentTypes = dbEqs;
      } catch {
        // Fallback
      }
    }

    const isEquipmentPage = input.pageType === "EQUIPMENT" || /\/(?:equip|machin|facilit)/i.test(input.sourceUrl);
    const best = new Map<string, ExtractedClaimCandidate>();

    for (const unit of splitIntoUnits(input.contentText ?? input.visibleText)) {
      for (const eq of equipmentTypes) {
        for (const phrase of [eq.canonicalName, ...(EQUIPMENT_ALIASES[eq.slug] || [])]) {
          const m = findPhrase(unit, phrase)[0];
          if (!m) continue;
          const context = classifyMatchContext(unit, m.index, m.length);
          // A dealer listing machines for sale is not a shop that owns them.
          const confidence =
            context === "RESALE" || context === "EXPLANATION"
              ? 0.5
              : isEquipmentPage
                ? 0.9
                : OWNERSHIP_CUE.test(unit)
                  ? 0.85
                  : 0.72;
          const prev = best.get(eq.slug);
          if (prev && prev.confidence >= confidence) continue;
          best.set(eq.slug, {
            claimType: "EQUIPMENT",
            rawValue: eq.canonicalName,
            normalizedValue: eq.slug,
            evidenceText: `Matched equipment "${phrase}" in sentence: "${unit.length > 300 ? snippetAround(unit, m.index, m.length, 140) : unit}"`,
            evidenceLocator: context === "RESALE" ? "body_text|context:RESALE" : "body_text",
            extractionMethod: phrase === eq.canonicalName ? ExtractionMethodEnum.TAXONOMY_EXACT : ExtractionMethodEnum.TAXONOMY_ALIAS,
            confidence,
            entityId: eq.id,
          });
        }
      }
    }
    return Array.from(best.values());
  }
}
