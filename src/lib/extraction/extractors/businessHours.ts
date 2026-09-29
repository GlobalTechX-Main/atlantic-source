import { ExtractionMethodEnum } from "@prisma/client";
import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";

const DAY = String.raw`(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?\.?`;
const TIME = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|\d{1,2}:\d{2}|noon|midnight)`;
const DASH = String.raw`\s*(?:-|–|—|to|through|thru)\s*`;

/** "Monday - Friday: 8:00am to 5:00pm", "Mon–Fri 7:30 AM – 4:30 PM", "Saturday 8am-12pm" */
const HOURS = new RegExp(
  String.raw`\b(${DAY}(?:${DASH}${DAY})?(?:\s*(?:,|&|and)\s*${DAY})?)\s*[:,]?\s*(${TIME}${DASH}${TIME}|closed|24\s*hours)`,
  "gi"
);
const ALWAYS_OPEN = /\b(?:open|available|service|support|emergency)\s+24\s*\/\s*7\b|\b24\s*\/\s*7\s+(?:service|support|emergency|availability|parts|dispatch)\b/i;

function tidy(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*(?:–|—|-|to|through|thru)\s*/gi, " – ")
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/(\d)\s*([ap])\.?m\.?/gi, (_m, d: string, ap: string) => `${d} ${ap.toUpperCase()}M`)
    .replace(/[.,]+$/, "")
    .trim();
}

/** Opening hours written on the company's site (usually the contact page or footer). */
export class BusinessHoursExtractor implements BaseExtractor {
  public name = "BUSINESS_HOURS_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const text = (input.fullText ?? input.visibleText).replace(/\n/g, " ");
    const out = new Map<string, ExtractedClaimCandidate>();
    for (const m of text.matchAll(HOURS)) {
      const value = `${tidy(m[1] || "")}: ${tidy(m[2] || "")}`;
      const key = value.toLowerCase();
      if (out.has(key) || out.size >= 4) continue;
      const at = m.index ?? 0;
      out.set(key, {
        claimType: "BUSINESS_HOURS",
        rawValue: value,
        normalizedValue: key.replace(/[^a-z0-9]+/g, "-"),
        evidenceText: `Hours on ${input.sourceUrl}: "${text.slice(Math.max(0, at - 40), at + m[0].length + 10).trim()}"`,
        evidenceLocator: "HOURS_TEXT",
        extractionMethod: ExtractionMethodEnum.PAGE_STRUCTURE,
        confidence: 0.85,
      });
    }
    const always = ALWAYS_OPEN.exec(text);
    if (always && !out.has("24/7")) {
      out.set("24/7", {
        claimType: "BUSINESS_HOURS",
        rawValue: "Available 24/7",
        normalizedValue: "24-7",
        evidenceText: `On ${input.sourceUrl}: "${text.slice(Math.max(0, always.index - 40), always.index + always[0].length + 20).trim()}"`,
        evidenceLocator: "HOURS_TEXT",
        extractionMethod: ExtractionMethodEnum.PAGE_STRUCTURE,
        confidence: 0.85,
      });
    }
    return [...out.values()];
  }
}
