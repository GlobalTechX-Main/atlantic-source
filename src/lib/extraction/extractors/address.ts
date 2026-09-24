import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";

/**
 * Atlantic Canadian postal codes only: A = Newfoundland and Labrador, B = Nova Scotia,
 * C = Prince Edward Island, E = New Brunswick. Offices elsewhere are not sourcing
 * locations for this platform.
 */
const ATLANTIC_POSTAL_REGEX = /(?<![A-Za-z0-9])[ABCE]\d[A-Z][ -]?\d[A-Z]\d(?![0-9])/gi;
const PHONE_LIKE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const STREET_START = /\b(?:\d{1,6}[A-Za-z]?(?:[-–]\d{1,6})?,?\s+[A-Za-zÀ-ÿ0-9'.]|(?:P\.?\s?O\.?\s+Box|Box|Unit|Suite)\s+\d)/i;
const ANY_POSTAL = /(?<![A-Za-z0-9])[A-Z]\d[A-Z][ -]?\d[A-Z]\d(?![0-9])/gi;

export type LocationRole = "HEADQUARTERS" | "BRANCH" | "FACILITY" | "SERVICE_REGION" | "PROJECT_OR_CLIENT_LOCATION" | "UNKNOWN";

export function classifyLocationRole(snippet: string, pageText: string, pageUrl: string, addressCountOnPage = 1): LocationRole {
  const lowerSnippet = snippet.toLowerCase();

  if (/\b(?:project\s+(?:location|site)|job\s*site|client\s+site|completed\s+work|recent\s+project|case\s+study)\b/.test(lowerSnippet)) {
    return "PROJECT_OR_CLIENT_LOCATION";
  }
  if (/\b(?:head office|headquarters|corporate hq|main office|home office|main shop|corporate office)\b/.test(lowerSnippet)) {
    return "HEADQUARTERS";
  }
  if (/\b(?:branch|office location|regional office|satellite office|locations:|our locations)\b/.test(lowerSnippet)) {
    return "BRANCH";
  }
  if (/\b(?:fabrication shop|manufacturing plant|plant|warehouse|yard|facility)\b/.test(lowerSnippet)) {
    return "FACILITY";
  }
  if (/\b(?:serving|service area)\b/.test(lowerSnippet)) {
    return "SERVICE_REGION";
  }
  // A page that lists many addresses is a branch directory, not one head office.
  if (addressCountOnPage >= 3) return "BRANCH";

  const lowerUrl = pageUrl.toLowerCase();
  if (lowerUrl.includes("/contact") || lowerUrl.includes("/about") || lowerUrl.includes("/location") || /\boffice\b/.test(lowerSnippet)) {
    return "HEADQUARTERS";
  }
  // One address on the site's pages is almost always the company's own premises.
  if (addressCountOnPage === 1 && /\b(?:head office|headquarters)\b/i.test(pageText) === false) {
    return "HEADQUARTERS";
  }
  return "UNKNOWN";
}

const STREET_WORD =
  /\b(?:st|street|ave|avenue|rd|road|dr|drive|blvd|boul|boulevard|bl|way|cres|crescent|court|ct|lane|ln|row|place|pl|highway|hwy|route|rte|rue|chemin|ch|parkway|pkwy|terrace|circle|close|trail|square|sq|park|path|quay|wharf)\b\.?/i;
const NUMERIC_START = /\b\d{1,6}[A-Za-z]?(?:[-–]\d{1,6})?,?\s+(?=[A-Za-zÀ-ÿ])/g;
const PO_BOX = /\b(?:P\.?\s?O\.?\s+Box|Box)\s+\d+/i;

/**
 * Cuts an address out of the text in front of a postal code. It starts at the last street
 * number that is followed by a street word ("55 Akerley Blvd - Unit #10" starts at 55, not
 * at 10), or at a PO Box, and drops phone numbers and menu words glued in front of it.
 */
export function cleanAddressSnippet(before: string, postal: string): string | null {
  // Drop phone numbers and any earlier postal code (the end of a previous address).
  let text = before.replace(PHONE_LIKE, " ");
  const lastPostal = [...text.matchAll(ANY_POSTAL)].pop();
  if (lastPostal && lastPostal.index !== undefined) text = text.slice(lastPostal.index + lastPostal[0].length);
  text = text.replace(/\s+/g, " ").slice(-160);

  const starts = [...text.matchAll(NUMERIC_START)].map((m) => m.index ?? 0);
  let chosen = -1;
  for (let i = starts.length - 1; i >= 0; i--) {
    const candidate = text.slice(starts[i]);
    if (STREET_WORD.test(candidate.slice(0, 60))) {
      chosen = starts[i]!;
      break;
    }
  }
  if (chosen === -1) {
    const box = PO_BOX.exec(text);
    if (box) chosen = box.index;
    else if (starts.length > 0) chosen = starts[0]!;
    else if (STREET_START.test(text)) chosen = text.search(STREET_START);
  }
  if (chosen === -1) return null;

  const address = `${text.slice(chosen).trim().replace(/[,\s•|-]+$/, "")} ${postal}`.replace(/\s+/g, " ").trim();
  return address.length >= 12 ? address : null;
}

export class AddressExtractor implements BaseExtractor {
  public name = "ADDRESS_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];
    const text = input.fullText ?? input.visibleText;
    const seenPostal = new Set<string>();

    const regex = new RegExp(ATLANTIC_POSTAL_REGEX.source, "gi");
    const matches = [...text.matchAll(regex)];
    const distinctPostals = new Set(matches.map((m) => m[0].replace(/[\s-]+/g, "").toUpperCase()));

    for (const match of matches) {
      const raw = match[0];
      const idx = match.index ?? 0;
      const normalizedPostal = raw.replace(/[\s-]+/g, "").toUpperCase();
      const formattedPostal = `${normalizedPostal.slice(0, 3)} ${normalizedPostal.slice(3)}`;
      if (seenPostal.has(normalizedPostal)) continue;

      // Look back over at most the previous two lines for the street part.
      const lineStart = text.lastIndexOf("\n", idx);
      const prevLineStart = lineStart > 0 ? text.lastIndexOf("\n", lineStart - 1) : -1;
      const prevPrevLineStart = prevLineStart > 0 ? text.lastIndexOf("\n", prevLineStart - 1) : -1;
      const from = Math.max(prevPrevLineStart + 1, idx - 160);
      const before = text.slice(from, idx).replace(/\n/g, ", ");

      let address = cleanAddressSnippet(before, formattedPostal);
      if (!address) continue;
      // Some sites put the city after the postal code: "39 Sagona Avenue, A1N 4P9, Mount Pearl".
      const lineEnd = text.indexOf("\n", idx);
      const after = text.slice(idx + raw.length, lineEnd === -1 ? idx + raw.length + 40 : Math.min(lineEnd, idx + raw.length + 40));
      const trailingCity = after.match(/^\s*,\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'’-]{2,28}?)(?:,?\s+(?:CA|Canada))?\s*$/);
      if (trailingCity?.[1] && !address.toLowerCase().includes(trailingCity[1].toLowerCase())) {
        address = `${address}, ${trailingCity[1].trim()}`;
      }
      seenPostal.add(normalizedPostal);

      // Role cues come from the address and the one or two lines just above it (e.g. "Head Office").
      const context = `${before} ${raw}`.replace(/\s+/g, " ");
      const role = classifyLocationRole(context, text, input.sourceUrl, distinctPostals.size);

      claims.push({
        claimType: "LOCATION",
        rawValue: address,
        normalizedValue: formattedPostal,
        evidenceText: `Extracted address snippet: "${address}" (Role: ${role})`,
        evidenceLocator: `location_role:${role}`,
        extractionMethod: ExtractionMethodEnum.ADDRESS_PARSER,
        confidence: role === "UNKNOWN" ? 0.7 : 0.9,
      });
    }

    return claims;
  }
}
