import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";
import { db } from "@/lib/db";
import { findPhrase, splitIntoUnits, snippetAround } from "../text";

const FALLBACK_CERTIFICATIONS = [
  { id: "cert_cwb", canonicalName: "CWB W47.1 Certification", slug: "cwb-w47-1" },
  { id: "cert_iso", canonicalName: "ISO 9001 Quality Management", slug: "iso-9001" },
  { id: "cert_cor", canonicalName: "COR Safety Certification", slug: "cor-safety" },
  { id: "cert_asme", canonicalName: "ASME Pressure Piping / Vessel", slug: "asme-pressure-vessel" },
];

interface CertPattern {
  /** Each pattern must match as a whole token; acronyms are case-sensitive. */
  patterns: RegExp[];
  /** When set, a sentence without this context is kept at lower confidence. */
  supportingContext?: RegExp;
}

/**
 * Exact patterns for the built-in certifications. Short acronyms are matched only as
 * whole, upper-case tokens so "COR" never matches "incorporated" or "corrosion" and
 * "ISO 9001" never matches "supervisors" or "ISO 45001".
 */
const KNOWN_PATTERNS: Record<string, CertPattern> = {
  "iso-9001": {
    patterns: [/(?<![A-Za-z0-9])ISO[\s\-:]*9001(?![0-9])/i],
  },
  "cor-safety": {
    patterns: [/(?<![A-Za-z0-9])COR(?![A-Za-z0-9])(?!\s*-\s*\d)/, /certificate\s+of\s+recognition/i],
  },
  "asme-pressure-vessel": {
    patterns: [/(?<![A-Za-z0-9])ASME(?![A-Za-z0-9])/],
    supportingContext: /certif|accredit|stamp|registered|code|section\s+viii|b31|procedure|qualified|standard/i,
  },
};

const CWB_W47_1 = /(?<![A-Za-z0-9])(?:CSA\s*)?W\s?47\.1(?![0-9])/i;
const CWB_CERTIFIED = /(?<![A-Za-z0-9])CWB[\s-]+(?:certified|certification|approved)|certified\s+(?:by|to|with)\s+(?:the\s+)?(?:CWB|Canadian\s+Welding\s+Bureau)/i;
const CWB_ORG = /Canadian\s+Welding\s+Bureau/i;

const TENTATIVE = /\b(?:working\s+towards?|pursuing|in\s+progress|applying\s+for|expected\s+(?:to|in)|planned|seeking)\b/i;
const OTHERS_HOLD_IT = /\b(?:our\s+(?:suppliers?|vendors?|partners?|clients?|customers?)|require[sd]?\s+(?:by|that)|must\s+be)\b/i;

interface CertHit {
  slug: string;
  rawValue: string;
  confidence: number;
  evidence: string;
  locator: string;
  entityId: string;
}

function firstMatch(text: string, patterns: RegExp[]): RegExpExecArray | null {
  for (const p of patterns) {
    const rx = new RegExp(p.source, p.flags.replace("g", ""));
    const m = rx.exec(text);
    if (m) return m;
  }
  return null;
}

export class CertificationExtractor implements BaseExtractor {
  public name = "CERTIFICATION_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    let certifications: { id: string; canonicalName: string; slug: string }[] = FALLBACK_CERTIFICATIONS;
    if (process.env.NODE_ENV !== "test") {
      try {
        const dbCerts = await db.certification.findMany({ where: { active: true } });
        if (dbCerts.length > 0) certifications = dbCerts;
      } catch {
        // Fallback
      }
    }

    const content = input.contentText ?? input.visibleText;
    const units: { text: string; locator: string; weight: number }[] = [
      ...splitIntoUnits(content).map((text) => ({ text, locator: "body_text", weight: 1 })),
      ...(input.headings || []).map((h) => ({ text: h.text, locator: `heading_${h.level}`, weight: 1 })),
      // Certification logos are often images; their alt text is weaker evidence.
      ...(input.imageAlts || []).map((alt) => ({ text: alt, locator: "image_alt", weight: 0.85 })),
    ];

    const hits = new Map<string, CertHit>();
    const keep = (hit: CertHit) => {
      const prev = hits.get(hit.slug);
      if (!prev || hit.confidence > prev.confidence) hits.set(hit.slug, hit);
    };

    for (const unit of units) {
      const qualifier = TENTATIVE.test(unit.text) || OTHERS_HOLD_IT.test(unit.text) ? 0.6 : 1;

      for (const cert of certifications) {
        if (cert.slug.startsWith("cwb")) {
          const w47 = CWB_W47_1.exec(unit.text);
          const certified = w47 ? null : CWB_CERTIFIED.exec(unit.text);
          const org = w47 || certified ? null : CWB_ORG.exec(unit.text);
          const m = w47 || certified || org;
          if (!m) continue;
          const slug = w47 ? "cwb-w47-1" : certified ? "cwb-certified" : "cwb-organization";
          const rawValue = w47
            ? "CWB W47.1 Certification"
            : certified
              ? "CWB Certified (Standard Unspecified)"
              : "Canadian Welding Bureau (Organization Mention)";
          const base = w47 ? 0.85 : certified ? 0.75 : 0.6;
          keep({
            slug,
            rawValue,
            confidence: base * qualifier,
            evidence: unit.text.length > 300 ? snippetAround(unit.text, m.index, m[0].length, 140) : unit.text,
            locator: unit.locator,
            entityId: cert.id,
          });
          continue;
        }

        const known = KNOWN_PATTERNS[cert.slug];
        let index = -1;
        let length = 0;
        if (known) {
          const m = firstMatch(unit.text, known.patterns);
          if (m) {
            index = m.index;
            length = m[0].length;
          }
        } else {
          const m = findPhrase(unit.text, cert.canonicalName)[0];
          if (m) {
            index = m.index;
            length = m.length;
          }
        }
        if (index < 0) continue;

        const contextFactor = known?.supportingContext && !known.supportingContext.test(unit.text) ? 0.7 : 1;
        keep({
          slug: cert.slug,
          rawValue: cert.canonicalName,
          confidence: Math.round(0.8 * qualifier * contextFactor * unit.weight * 1000) / 1000,
          evidence: unit.text.length > 300 ? snippetAround(unit.text, index, length, 140) : unit.text,
          locator: unit.locator,
          entityId: cert.id,
        });
      }
    }

    return Array.from(hits.values()).map((hit) => ({
      claimType: "CERTIFICATION" as const,
      rawValue: hit.rawValue,
      normalizedValue: hit.slug,
      evidenceText: `Matched certification reference in sentence: "${hit.evidence}"`,
      evidenceLocator: hit.locator,
      extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
      confidence: hit.confidence,
      entityId: hit.entityId,
    }));
  }
}
