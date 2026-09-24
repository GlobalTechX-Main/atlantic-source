/**
 * Text helpers shared by all extractors.
 *
 * Every taxonomy match in the extraction layer goes through these helpers so that a
 * phrase only matches as a whole word or phrase. Plain substring matching produced
 * false facts such as "COR" inside "incorporated" or "ISO" inside "supervisors".
 */

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a case-insensitive regular expression that matches `phrase` only as a whole
 * word or phrase. Whitespace inside the phrase matches any run of whitespace or hyphens,
 * and "&" also matches "and".
 */
export function buildPhraseRegex(phrase: string, flags = "giu"): RegExp {
  const parts = phrase
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === "&" || word.toLowerCase() === "and" ? "(?:&|and)" : escapeRegExp(word)));
  const body = parts.join("[\\s\\-]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, flags);
}

const phraseRegexCache = new Map<string, RegExp>();

function cachedPhraseRegex(phrase: string): RegExp {
  const key = phrase.toLowerCase();
  let rx = phraseRegexCache.get(key);
  if (!rx) {
    rx = buildPhraseRegex(phrase);
    phraseRegexCache.set(key, rx);
  }
  return rx;
}

export interface PhraseMatch {
  index: number;
  length: number;
  text: string;
}

/** Returns every whole-phrase match of `phrase` in `text`. */
export function findPhrase(text: string, phrase: string): PhraseMatch[] {
  if (!text || !phrase.trim()) return [];
  const rx = cachedPhraseRegex(phrase);
  rx.lastIndex = 0;
  const matches: PhraseMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    matches.push({ index: m.index, length: m[0].length, text: m[0] });
    if (m[0].length === 0) rx.lastIndex++;
  }
  return matches;
}

export function containsPhrase(text: string, phrase: string): boolean {
  return findPhrase(text, phrase).length > 0;
}

/**
 * Splits page text into short evidence units: one per line (block element) and then
 * one per sentence. Units longer than `maxLength` are cut on list-like separators so a
 * single run-on block cannot become one giant "sentence".
 */
export function splitIntoUnits(text: string, maxLength = 400): string[] {
  if (!text) return [];
  const units: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmedLine = line.replace(/\s+/g, " ").trim();
    if (!trimmedLine) continue;
    for (const sentence of trimmedLine.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)) {
      const s = sentence.trim();
      if (!s) continue;
      if (s.length <= maxLength) {
        units.push(s);
        continue;
      }
      for (const piece of s.split(/\s*(?:[•|·▪►»]|\s-\s|;)\s*/)) {
        const p = piece.trim();
        if (p) units.push(p.length > maxLength ? p.slice(0, maxLength) : p);
      }
    }
  }
  return units;
}

/** Returns a window of text around a match, trimmed to whole words. */
export function snippetAround(text: string, index: number, length: number, radius = 120): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = snippet.replace(/^\S*\s/, "");
  if (end < text.length) snippet = snippet.replace(/\s\S*$/, "");
  return snippet.replace(/\s+/g, " ").trim();
}

export type MatchContext =
  | "DIRECT"
  | "RESALE"
  | "AUDIENCE"
  | "JOB_TITLE"
  | "PROJECT_REFERENCE"
  | "PRODUCT_MENTION"
  | "EDUCATION"
  | "EXPLANATION";

const RESALE_NEAR = /\b(?:supplies|suppliers?|distribut(?:e|es|or|ors|ion)|dealers?|retail(?:er)?|stockists?|in\s+stock|catalog(?:ue)?|shop\s+(?:for|now|online)|buy|purchase|sell(?:s|ing)?|sales\s+of|rentals?|parts\s+(?:and|&)\s+accessories|consumables|accessories)\b/i;
const SUPPLY_AND_INSTALL = /\bsuppl(?:y|ies)\s+(?:and|&)\s+install/i;
const RESALE_CUE = /\b(?:we\s+(?:sell|carry|stock|distribute)|authori[sz]ed\s+(?:dealer|distributor)|distributor\s+of|dealer\s+for|full\s+line\s+of)\b/i;
const AUDIENCE_BEFORE = /\b(?:to|for|serving|serve|serves|supporting|supports?|helping|help|clients?\s+in|customers?\s+in|partner\s+to)\s+(?:the\s+|our\s+|your\s+|all\s+|local\s+|industrial\s+|complex\s+)*(?:[\w&-]+\s+){0,3}$/i;
const AUDIENCE_AFTER = /^\s*(?:industr(?:y|ies)|facilit(?:y|ies)|shops?|companies|customers|clients|sector|market|challenges|operations|plants|professionals|contractors)\b/i;
const JOB_TITLE_AFTER = /^\s*(?:manager|supervisor|superintendent|foreman|coordinator|lead|leader|technician|technologist|inspector|engineer|director|specialist|apprentice|helper)s?\b/i;
const AUDIENCE_YOU = /\b(?:whether\s+you(?:['’]re|\s+are)|if\s+you(?:['’]re|\s+are)|you\s+are\s+an?|for\s+(?:every|any)|ideal\s+for)\s+(?:an?\s+)?(?:[\w&-]+\s+){0,2}$/i;
/** The phrase names a thing ("welding machine", "ventilation system"), not a service. */
const PRODUCT_AFTER = /^\s*(?:bureau|inspections?|codes?|systems?|machines?|machinery|cent(?:er|re)s?|units?|equipment|products?|registers?|trays?|tools?|supplies|parts|kits?|helmets?|consumables|guns?|torches?|rods?|wire|fans?|dampers?|motors?|pumps?|valves?|components?|solutions?\s+(?:for\s+sale))\b/i;
const EDUCATION_CUE = /\b(?:graduate[ds]?|graduated|degree|diploma|program(?:me)?|studying|student|scholarship|university|college|institute\s+of\s+technology|certificate\s+program|course)\b/i;
const EXPLANATION_AFTER = /^\s*(?:(?:is|are)\s+(?:a|an|the)\s+(?:\w+\s+){0,2}(?:process|method|technique|type|form|way|term|practice)\b|stands\s+for\b)/i;
/** Article-style headlines: "How Industrial Automation Helps...", "What is CNC machining?" */
const HEADLINE_START = /^(?:how|why|what\s+(?:is|are)|\d+\s+(?:ways|tips|reasons)|the\s+(?:benefits|importance)\s+of)\b/i;
/** "trays for ventilation", "applications such as welding": the product is for that use. */
const PRODUCT_BEFORE = /\b(?:(?:trays?|boxes|packaging|products?|parts|kits?|tools?|solutions?)\s+for|applications?\s+(?:such\s+as|like|including))\s+(?:[\w,]+\s+){0,4}$/i;
const PROJECT_CUE = /\b(?:(?:this|the)\s+(?:\w+\s+){0,4}project\s+(?:involved|included|required|consisted)|project\s+(?:profile|included|for)|case\s+study|client:|owner:|completed\s+for|on\s+behalf\s+of|for\s+the\s+(?:city|town|province|department|university|hospital))\b/i;

/**
 * Classifies how a matched phrase is used in its sentence: a direct statement that the
 * company does the work, or a weaker use such as selling supplies for it, serving
 * customers who do it, a job title, or a reference inside a project description.
 */
export function classifyMatchContext(unit: string, index: number, length: number): MatchContext {
  const before = unit.slice(Math.max(0, index - 60), index);
  const after = unit.slice(index + length, index + length + 40);
  const window = unit.slice(Math.max(0, index - 50), Math.min(unit.length, index + length + 50));

  if (JOB_TITLE_AFTER.test(after)) return "JOB_TITLE";
  if (EXPLANATION_AFTER.test(after) || HEADLINE_START.test(unit)) return "EXPLANATION";
  if (PRODUCT_BEFORE.test(before)) return "PRODUCT_MENTION";
  if (AUDIENCE_AFTER.test(after) && AUDIENCE_BEFORE.test(before)) return "AUDIENCE";
  if (AUDIENCE_YOU.test(before)) return "AUDIENCE";
  if (EDUCATION_CUE.test(unit)) return "EDUCATION";
  // An explicit "we sell / distributor of" statement beats "names a product".
  if (RESALE_CUE.test(unit)) return "RESALE";
  if (PRODUCT_AFTER.test(after)) return "PRODUCT_MENTION";
  if (!SUPPLY_AND_INSTALL.test(window) && (RESALE_CUE.test(unit) || RESALE_NEAR.test(window))) return "RESALE";
  if (PROJECT_CUE.test(unit)) return "PROJECT_REFERENCE";
  return "DIRECT";
}

export const CONTEXT_CONFIDENCE_FACTOR: Record<MatchContext, number> = {
  DIRECT: 1,
  PROJECT_REFERENCE: 0.75,
  JOB_TITLE: 0.7,
  PRODUCT_MENTION: 0.65,
  RESALE: 0.55,
  EXPLANATION: 0.5,
  AUDIENCE: 0.45,
  EDUCATION: 0.35,
};

export const CONTEXT_REVIEW_NOTE: Record<MatchContext, string> = {
  DIRECT: "",
  PROJECT_REFERENCE: "appears inside a project or client description",
  JOB_TITLE: "appears only as part of a job title",
  RESALE: "appears in a product, supply or resale context",
  AUDIENCE: "describes customers the company serves, not work it does",
  PRODUCT_MENTION: "names a machine, system or product rather than a service",
  EDUCATION: "appears in a biography or education description",
  EXPLANATION: "appears in general explanatory text",
};
