import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";

// Canadian Postal Code regex format: A1A 1A1 or A1A1A1
const CANADIAN_POSTAL_REGEX = /[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d/g;
const NB_CITIES = ["saint john", "fredericton", "moncton", "dieppe", "riverview", "quispamsis", "rothesay", "miramichi", "edmundston", "bathurst", "halifax", "dartmouth", "sydney", "truro", "charlottetown", "st. john's"];

export type LocationRole = "HEADQUARTERS" | "BRANCH" | "FACILITY" | "SERVICE_REGION" | "PROJECT_OR_CLIENT_LOCATION" | "UNKNOWN";

export function classifyLocationRole(snippet: string, pageText: string, pageUrl: string): LocationRole {
  const lowerSnippet = snippet.toLowerCase();
  const lowerPage = pageText.toLowerCase();

  // Project or Client location check
  if (
    lowerSnippet.includes("project") ||
    lowerSnippet.includes("client site") ||
    lowerSnippet.includes("completed work") ||
    lowerSnippet.includes("recent project") ||
    lowerSnippet.includes("case study")
  ) {
    return "PROJECT_OR_CLIENT_LOCATION";
  }

  // Headquarters cues
  if (
    lowerSnippet.includes("head office") ||
    lowerSnippet.includes("headquarters") ||
    lowerSnippet.includes("corporate hq") ||
    lowerSnippet.includes("main office") ||
    lowerSnippet.includes("home office") ||
    lowerSnippet.includes("main shop") ||
    lowerPage.includes("head office") ||
    lowerPage.includes("headquarters")
  ) {
    return "HEADQUARTERS";
  }

  // Branch office cues
  if (
    lowerSnippet.includes("branch office") ||
    lowerSnippet.includes("branch") ||
    lowerSnippet.includes("office location") ||
    lowerSnippet.includes("regional office") ||
    lowerSnippet.includes("satellite office") ||
    lowerSnippet.includes("locations:") ||
    lowerSnippet.includes("our locations")
  ) {
    return "BRANCH";
  }

  // Facility cues
  if (
    lowerSnippet.includes("fabrication shop") ||
    lowerSnippet.includes("manufacturing plant") ||
    lowerSnippet.includes("plant") ||
    lowerSnippet.includes("warehouse") ||
    lowerSnippet.includes("yard")
  ) {
    return "FACILITY";
  }

  // Service region phrases
  if (
    lowerSnippet.includes("serving") ||
    lowerSnippet.includes("service area") ||
    lowerSnippet.includes("serving atlantic canada") ||
    lowerSnippet.includes("serving new brunswick")
  ) {
    return "SERVICE_REGION";
  }

  // Default locator check: if page is Contact Us or Footer with main street address
  if (pageUrl.includes("/contact") || pageUrl.includes("/about") || lowerSnippet.includes("office")) {
    return "HEADQUARTERS";
  }

  return "UNKNOWN";
}

export class AddressExtractor implements BaseExtractor {
  public name = "ADDRESS_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];
    const seenAddresses = new Set<string>();

    const regex = new RegExp(CANADIAN_POSTAL_REGEX.source, "gi");
    let match: RegExpExecArray | null = null;

    while ((match = regex.exec(input.visibleText)) !== null) {
      const postalCode = match[0];
      const idx = match.index;
      const normalizedPostal = postalCode.replace(/\s+/g, "").toUpperCase();
      const formattedPostal = `${normalizedPostal.slice(0, 3)} ${normalizedPostal.slice(3)}`;

      const snippetStart = Math.max(0, idx - 80);
      const snippetEnd = Math.min(input.visibleText.length, idx + postalCode.length + 20);
      let addressSnippet = input.visibleText.substring(snippetStart, snippetEnd).trim();

      // Clean concatenated navigation/header text prior to street number
      const streetNumMatch = addressSnippet.match(/\b\d{1,5}\s+[A-Za-z0-9\s.,-]+/);
      if (streetNumMatch && streetNumMatch[0]) {
        addressSnippet = streetNumMatch[0].trim();
      }

      const lowerSnippet = addressSnippet.toLowerCase();
      const hasCity = NB_CITIES.some((city) => lowerSnippet.includes(city));

      const dedupKey = `${addressSnippet.toLowerCase()}:${formattedPostal}`;
      if (hasCity && !seenAddresses.has(dedupKey)) {
        seenAddresses.add(dedupKey);

        const role = classifyLocationRole(addressSnippet, input.visibleText, input.sourceUrl);

        claims.push({
          claimType: "LOCATION",
          rawValue: addressSnippet,
          normalizedValue: formattedPostal,
          evidenceText: `Extracted address snippet: "${addressSnippet}" (Role: ${role})`,
          evidenceLocator: `location_role:${role}`,
          extractionMethod: ExtractionMethodEnum.ADDRESS_PARSER,
          confidence: role === "UNKNOWN" ? 0.7 : 0.9,
        });
      }
    }

    return claims;
  }
}
