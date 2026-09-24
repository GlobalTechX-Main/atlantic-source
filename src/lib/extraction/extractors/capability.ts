import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";
import { db } from "@/lib/db";
import {
  findPhrase,
  splitIntoUnits,
  snippetAround,
  classifyMatchContext,
  CONTEXT_CONFIDENCE_FACTOR,
  MatchContext,
} from "../text";
import { TAXONOMY_CAPABILITIES, TAXONOMY_ALIASES, RETIRED_ALIASES } from "@/lib/taxonomy/capabilities";

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

export const FALLBACK_CAPABILITIES = TAXONOMY_CAPABILITIES;
export const FALLBACK_ALIASES = TAXONOMY_ALIASES;

interface CapabilityTerm {
  capabilityId: string;
  slug: string;
  canonicalName: string;
  phrase: string;
  isAlias: boolean;
}

interface BestMatch {
  term: CapabilityTerm;
  confidence: number;
  context: MatchContext;
  locator: string;
  evidence: string;
  directMentions: number;
}

/**
 * Aliases that are ordinary words on many sites ("hydraulics", "ventilation"). They only
 * count at full strength in a page title, heading or on a services page.
 */
const WEAK_ALIASES = new Set(["hydraulics", "ventilation", "excavation", "high voltage", "civil engineering", "electrical wiring", "equipment installation", "automation systems", "machine automation"]);

/** Pages whose text is mostly about other people or news, not the company's services. */
const LOW_VALUE_PAGE = /\/(?:testimonials?|reviews?|blog|news|articles?|posts?|stories|case-stud(?:y|ies)|team|our-team|people|careers?)(?:\/|$|-)/i;

const SERVICE_URL_HINTS = ["/service", "/capabilit", "/what-we-do", "/our-work", "/solutions", "/specialties", "/expertise"];

export class CapabilityExtractor implements BaseExtractor {
  public name = "CAPABILITY_EXTRACTOR";

  private async loadTerms(): Promise<CapabilityTerm[]> {
    let capabilities: { id: string; canonicalName: string; slug: string }[] = FALLBACK_CAPABILITIES;
    let aliases: { alias: string; capabilityId: string; normalizedAlias: string }[] = FALLBACK_ALIASES;

    if (process.env.NODE_ENV !== "test") {
      try {
        const dbCaps = await db.capability.findMany({ where: { active: true } });
        if (dbCaps.length > 0) {
          const existingSlugs = new Set(dbCaps.map((c) => c.slug));
          capabilities = [
            ...dbCaps.map((c) => ({ id: c.id, canonicalName: c.canonicalName, slug: c.slug })),
            ...FALLBACK_CAPABILITIES.filter((f) => !existingSlugs.has(f.slug)),
          ];
        }
        const dbAliases = await db.capabilityAlias.findMany();
        if (dbAliases.length > 0) {
          const existing = new Set(dbAliases.map((a) => a.normalizedAlias));
          aliases = [...dbAliases, ...FALLBACK_ALIASES.filter((fa) => !existing.has(fa.normalizedAlias))];
        }
      } catch {
        // Fall back to the static taxonomy
      }
    }

    const byId = new Map(capabilities.map((c) => [c.id, c]));
    const bySlug = new Map(capabilities.map((c) => [c.slug, c]));
    const terms: CapabilityTerm[] = capabilities.map((c) => ({
      capabilityId: c.id,
      slug: c.slug,
      canonicalName: c.canonicalName,
      phrase: c.canonicalName,
      isAlias: false,
    }));

    for (const a of aliases) {
      if (RETIRED_ALIASES.has(a.normalizedAlias.toLowerCase())) continue;
      // Aliases may point at a static taxonomy id while the DB uses its own ids.
      const fallbackCap = FALLBACK_CAPABILITIES.find((f) => f.id === a.capabilityId);
      const cap = byId.get(a.capabilityId) || (fallbackCap ? bySlug.get(fallbackCap.slug) : undefined);
      if (!cap) continue;
      terms.push({ capabilityId: cap.id, slug: cap.slug, canonicalName: cap.canonicalName, phrase: a.alias, isAlias: true });
    }
    return terms;
  }

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const terms = await this.loadTerms();
    const content = input.contentText ?? input.visibleText;

    const isServicePage =
      input.pageType === "SERVICES" ||
      input.pageType === "CAPABILITIES" ||
      SERVICE_URL_HINTS.some((hint) => input.sourceUrl.toLowerCase().includes(hint));

    const pageWeight = LOW_VALUE_PAGE.test(input.sourceUrl) ? 0.8 : 1;
    const retailWeight = input.siteIsRetail ? 0.75 : 1;
    const units: { text: string; locator: string; weight: number }[] = [];
    if (input.pageTitle) units.push({ text: input.pageTitle, locator: "page_title", weight: 0.95 });
    for (const h of input.headings || []) {
      if (h.text?.trim()) units.push({ text: h.text.trim(), locator: `heading_${h.level}`, weight: isServicePage ? 0.95 : 0.9 });
    }
    for (const unit of splitIntoUnits(content)) {
      units.push({ text: unit, locator: isServicePage ? "services_page_body" : "body_text", weight: isServicePage ? 0.95 : 0.85 });
    }

    const best = new Map<string, BestMatch>();

    for (const unit of units) {
      if (isNegatedSentence(unit.text)) continue;

      for (const term of terms) {
        const matches = findPhrase(unit.text, term.phrase);
        for (const m of matches) {
          const context = classifyMatchContext(unit.text, m.index, m.length);
          const aliasFactor = term.isAlias ? 0.95 : 1;
          const isStrongSpot = unit.locator === "page_title" || unit.locator.startsWith("heading_") || unit.locator === "services_page_body";
          const weakFactor = term.isAlias && WEAK_ALIASES.has(term.phrase.toLowerCase()) && !isStrongSpot ? 0.8 : 1;
          const confidence =
            Math.round(unit.weight * aliasFactor * weakFactor * pageWeight * retailWeight * CONTEXT_CONFIDENCE_FACTOR[context] * 1000) / 1000;
          const evidence = unit.text.length > 300 ? snippetAround(unit.text, m.index, m.length, 140) : unit.text;

          const prev = best.get(term.capabilityId);
          const directMentions = (prev?.directMentions || 0) + (context === "DIRECT" ? 1 : 0);
          if (!prev || confidence > prev.confidence) {
            best.set(term.capabilityId, {
              term,
              confidence,
              context,
              locator: unit.locator,
              evidence,
              directMentions,
            });
          } else {
            prev.directMentions = directMentions;
          }
        }
      }
    }

    const claims: ExtractedClaimCandidate[] = [];
    for (const match of best.values()) {
      const boosted = match.context === "DIRECT" && match.directMentions >= 2 ? Math.min(0.98, match.confidence + 0.03) : match.confidence;
      const contextSuffix = match.context === "DIRECT" ? "" : `|context:${match.context}`;
      const label = match.term.isAlias ? `Matched alias "${match.term.phrase}"` : `Matched "${match.term.phrase}"`;
      claims.push({
        claimType: "CAPABILITY",
        rawValue: match.term.isAlias ? match.term.phrase : match.term.canonicalName,
        normalizedValue: match.term.slug,
        evidenceText: `${label} in ${match.locator}: "${match.evidence}"`,
        evidenceLocator: `${match.locator}${contextSuffix}`,
        extractionMethod: match.term.isAlias ? ExtractionMethodEnum.TAXONOMY_ALIAS : ExtractionMethodEnum.TAXONOMY_EXACT,
        confidence: boosted,
        entityId: match.term.capabilityId,
      });
    }
    return claims;
  }
}
