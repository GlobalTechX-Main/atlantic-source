import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";
import { db } from "@/lib/db";

const NEGATION_PATTERNS = [
  /do\s+not\s+(?:provide|offer|perform|do|fabricate|manufacture)/i,
  /don't\s+(?:provide|offer|perform|do|fabricate|manufacture)/i,
  /no\s+longer\s+(?:provide|offer|perform|do|fabricate|manufacture)/i,
  /not\s+providing/i,
  /exclude[s]?/i,
  /cannot\s+provide/i,
  /we\s+do\s+not/i,
];

export function isNegatedSentence(sentence: string): boolean {
  return NEGATION_PATTERNS.some((pattern) => pattern.test(sentence));
}

import { TAXONOMY_CAPABILITIES, TAXONOMY_ALIASES } from "@/lib/taxonomy/capabilities";

export const FALLBACK_CAPABILITIES = TAXONOMY_CAPABILITIES;
export const FALLBACK_ALIASES = TAXONOMY_ALIASES;

export class CapabilityExtractor implements BaseExtractor {
  public name = "CAPABILITY_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];

    let capabilities = FALLBACK_CAPABILITIES;
    let aliases = FALLBACK_ALIASES;

    if (process.env.NODE_ENV !== "test") {
      try {
        const dbCaps = await db.capability.findMany({ where: { active: true } });
        if (dbCaps.length > 0) {
          const existingSlugs = new Set(dbCaps.map(c => c.slug));
          const missingFallbacks = FALLBACK_CAPABILITIES.filter(f => !existingSlugs.has(f.slug));
          capabilities = [
            ...dbCaps.map(c => ({ id: c.id, canonicalName: c.canonicalName, slug: c.slug, description: c.description ?? undefined })),
            ...missingFallbacks
          ];
        }
        const dbAliases = await db.capabilityAlias.findMany();
        if (dbAliases.length > 0) {
          const existingAliases = new Set(dbAliases.map(a => a.normalizedAlias));
          const missingAliases = FALLBACK_ALIASES.filter(fa => !existingAliases.has(fa.normalizedAlias));
          aliases = [...dbAliases, ...missingAliases];
        }
      } catch {
        // Fallback to static baseline
      }
    }

    const isServicePage =
      input.sourceUrl.includes("/service") ||
      input.sourceUrl.includes("/capabilit") ||
      input.sourceUrl.includes("/what-we-do") ||
      input.sourceUrl.includes("/our-work") ||
      input.sourceUrl.includes("/solutions") ||
      input.sourceUrl.includes("/specialties");

    const baseConfidence = isServicePage ? 0.95 : 0.85;
    const seenCapabilityIds = new Set<string>();

    // Build text units from Headings, Page Title, and Visible Text Sentences
    const textUnits: { text: string; locator: string }[] = [];

    if (input.pageTitle) {
      textUnits.push({ text: input.pageTitle, locator: "page_title" });
    }

    for (const h of input.headings || []) {
      if (h.text && h.text.trim()) {
        textUnits.push({ text: h.text, locator: `heading_${h.level}` });
      }
    }

    const sentences = input.visibleText.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (sentence && sentence.trim()) {
        textUnits.push({ text: sentence, locator: isServicePage ? "services_page_body" : "body_text" });
      }
    }

    for (const unit of textUnits) {
      if (!unit.text.trim()) continue;
      if (isNegatedSentence(unit.text)) continue;

      const lowerText = unit.text.toLowerCase();

      for (const cap of capabilities) {
        if (seenCapabilityIds.has(cap.id)) continue;

        const lowerCapName = cap.canonicalName.toLowerCase();
        if (lowerText.includes(lowerCapName)) {
          seenCapabilityIds.add(cap.id);
          claims.push({
            claimType: "CAPABILITY",
            rawValue: cap.canonicalName,
            normalizedValue: cap.slug,
            evidenceText: `Matched in ${unit.locator}: "${unit.text.trim()}"`,
            evidenceLocator: unit.locator,
            extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
            confidence: baseConfidence,
            entityId: cap.id,
          });
        }
      }

      for (const alias of aliases) {
        if (seenCapabilityIds.has(alias.capabilityId)) continue;

        if (lowerText.includes(alias.normalizedAlias)) {
          seenCapabilityIds.add(alias.capabilityId);
          const targetCap = capabilities.find((c) => c.id === alias.capabilityId);
          claims.push({
            claimType: "CAPABILITY",
            rawValue: alias.alias,
            normalizedValue: targetCap?.slug || alias.normalizedAlias,
            evidenceText: `Matched alias "${alias.alias}" in ${unit.locator}: "${unit.text.trim()}"`,
            evidenceLocator: unit.locator,
            extractionMethod: ExtractionMethodEnum.TAXONOMY_ALIAS,
            confidence: baseConfidence * 0.95,
            entityId: alias.capabilityId,
          });
        }
      }
    }

    return claims;
  }
}
