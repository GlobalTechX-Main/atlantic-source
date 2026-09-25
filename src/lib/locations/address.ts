/**
 * Helpers for turning an approved address fact into a supplier location.
 * Pure functions (no database) so they are easy to test.
 */

export type AtlanticProvince = "NB" | "NS" | "PE" | "NL";

/** First letter of a Canadian postal code tells the province. */
const POSTAL_PROVINCE: Record<string, AtlanticProvince> = { E: "NB", B: "NS", C: "PE", A: "NL" };

/** Towns we expect to see in supplier addresses, longest names first so "Saint John's" wins over "Saint John". */
const KNOWN_PLACES: string[] = [
  "Grand Bay-Westfield",
  "Grand Falls",
  "St. John's",
  "Saint John's",
  "Saint John",
  "Fredericton",
  "Moncton",
  "Dieppe",
  "Riverview",
  "Shediac",
  "Memramcook",
  "Sackville",
  "Sussex",
  "Quispamsis",
  "Rothesay",
  "Hampton",
  "Oromocto",
  "Woodstock",
  "Miramichi",
  "Edmundston",
  "Bathurst",
  "Campbellton",
  "Caraquet",
  "Shippagan",
  "Tracadie",
  "Richibucto",
  "Bouctouche",
  "St. Stephen",
  "St. Andrews",
  "Balmoral",
  "Halifax",
  "Dartmouth",
  "Bedford",
  "Burnside",
  "Lower Sackville",
  "Truro",
  "Amherst",
  "New Glasgow",
  "Stellarton",
  "Antigonish",
  "Sydney",
  "Port Hawkesbury",
  "Kentville",
  "Windsor",
  "Bridgewater",
  "Yarmouth",
  "Elmsdale",
  "Charlottetown",
  "Summerside",
  "Mount Pearl",
  "Paradise",
  "Conception Bay South",
  "Corner Brook",
  "Gander",
  "Grand Falls-Windsor",
  "Labrador City",
  "Happy Valley-Goose Bay",
].sort((a, b) => b.length - a.length);

/**
 * Cities in the directory's city filter and the nearby towns counted with them.
 * A buyer looking for "Moncton" also wants shops in Dieppe and Riverview.
 */
export const METRO_AREAS: Record<string, string[]> = {
  "Saint John": ["Saint John", "Rothesay", "Quispamsis", "Grand Bay-Westfield", "Hampton"],
  Moncton: ["Moncton", "Dieppe", "Riverview", "Shediac", "Memramcook"],
  Fredericton: ["Fredericton", "Oromocto"],
};

/** The list of town names that count as the given city in search. */
export function metroTowns(city: string): string[] {
  const key = Object.keys(METRO_AREAS).find((k) => k.toLowerCase() === city.trim().toLowerCase());
  return (key && METRO_AREAS[key]) || [city.trim()];
}

export interface ParsedAddress {
  city: string | null;
  province: AtlanticProvince | null;
  postalCode: string | null;
}

const POSTAL_RE = /\b([ABCE]\d[A-Z])[ -]?(\d[A-Z]\d)\b/i;
const PROVINCE_RE = /\b(NB|N\.B\.|NS|N\.S\.|PE|PEI|P\.E\.I\.|NL|NF|New Brunswick|Nova Scotia|Prince Edward Island|Newfoundland(?: and Labrador)?)\b/i;

function provinceFromName(name: string): AtlanticProvince | null {
  const n = name.toLowerCase().replace(/\./g, "");
  if (n === "nb" || n.startsWith("new brunswick")) return "NB";
  if (n === "ns" || n.startsWith("nova scotia")) return "NS";
  if (n === "pe" || n === "pei" || n.startsWith("prince edward")) return "PE";
  if (n === "nl" || n === "nf" || n.startsWith("newfoundland")) return "NL";
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Reads city, province and postal code from one address line. */
export function parseAtlanticAddress(text: string): ParsedAddress {
  const postal = text.match(POSTAL_RE);
  const postalCode = postal ? `${postal[1]} ${postal[2]}`.toUpperCase() : null;
  const provinceWord = text.match(PROVINCE_RE);
  const provinceFromPostal = postalCode ? POSTAL_PROVINCE[postalCode.charAt(0)] : undefined;
  const province = provinceFromPostal ?? (provinceWord?.[1] ? provinceFromName(provinceWord[1]) : null);

  // The town is written just before the province / postal code, so prefer the last one found.
  let city: string | null = null;
  let cityAt = -1;
  for (const place of KNOWN_PLACES) {
    const re = new RegExp(`(?<![\\p{L}'])${escapeRegExp(place)}(?![\\p{L}'])`, "giu");
    for (const m of text.matchAll(re)) {
      const at = m.index ?? -1;
      // A longer name already covering this spot wins ("Saint John's" over "Saint John").
      if (at > cityAt) {
        city = place === "Saint John's" ? "St. John's" : place;
        cityAt = at;
      }
    }
  }

  if (!city) {
    // Fallback: "..., Some Town, NB" or "Some Town NS B3B 1A1"
    const m = text.match(/([A-Z][A-Za-z.'-]+(?:[ -][A-Z][A-Za-z.'-]+){0,2}),?\s+(?:NB|NS|PE|PEI|NL|N\.B\.|N\.S\.)\b/);
    if (m?.[1]) city = m[1].trim();
  }

  return { city, province, postalCode };
}

export type LocationRole =
  | "HEADQUARTERS"
  | "BRANCH"
  | "FACILITY"
  | "PROJECT_OR_CLIENT_LOCATION"
  | "SERVICE_REGION"
  | "OUT_OF_REGION"
  | "UNKNOWN";

/** Address facts carry their role in the evidence text: "(Role: BRANCH)". */
export function locationRoleFromEvidence(evidence: string | null | undefined): LocationRole {
  const m = (evidence || "").match(/Role:\s*([A-Z_]+)/);
  const role = m?.[1];
  switch (role) {
    case "HEADQUARTERS":
    case "BRANCH":
    case "FACILITY":
    case "PROJECT_OR_CLIENT_LOCATION":
    case "SERVICE_REGION":
    case "OUT_OF_REGION":
      return role;
    default:
      return "UNKNOWN";
  }
}

/** Roles that describe somewhere the company is not actually based. */
export function isNotACompanyLocation(role: LocationRole): boolean {
  return role === "PROJECT_OR_CLIENT_LOCATION" || role === "SERVICE_REGION" || role === "OUT_OF_REGION";
}

/** Placeholder rows made when a supplier was first added (before any address was found). */
export function isPlaceholderAddress(addressLine1: string): boolean {
  return /\(Seeded\)|^Primary (?:Location|Address)$|\(listed city\)/i.test(addressLine1.trim());
}
