import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";
import { db } from "@/lib/db";

const FALLBACK_EQUIPMENT = [
  { id: "eq_cnc_mill", canonicalName: "CNC Milling Machine", slug: "cnc-mill" },
  { id: "eq_brake_press", canonicalName: "Hydraulic Press Brake", slug: "hydraulic-press-brake" },
  { id: "eq_plasma", canonicalName: "CNC Plasma Cutting Table", slug: "cnc-plasma-cutter" },
  { id: "eq_lathe", canonicalName: "Industrial Lathe", slug: "industrial-lathe" },
];

export class EquipmentExtractor implements BaseExtractor {
  public name = "EQUIPMENT_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];

    let equipmentTypes = FALLBACK_EQUIPMENT;
    if (process.env.NODE_ENV !== "test") {
      try {
        const dbEqs = await db.equipmentType.findMany({ where: { active: true } });
        if (dbEqs.length > 0) equipmentTypes = dbEqs;
      } catch {
        // Fallback
      }
    }

    const sentences = input.visibleText.split(/(?<=[.!?])\s+/);
    const seenEqIds = new Set<string>();

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      for (const eq of equipmentTypes) {
        if (seenEqIds.has(eq.id)) continue;

        if (lowerSentence.includes(eq.canonicalName.toLowerCase())) {
          seenEqIds.add(eq.id);
          claims.push({
            claimType: "EQUIPMENT",
            rawValue: eq.canonicalName,
            normalizedValue: eq.slug,
            evidenceText: `Matched equipment in sentence: "${sentence.trim()}"`,
            evidenceLocator: "body_text",
            extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
            confidence: 0.85,
            entityId: eq.id,
          });
        }
      }
    }

    return claims;
  }
}
