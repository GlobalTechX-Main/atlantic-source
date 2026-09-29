import { findKnownPlaces, metroTowns, parseAtlanticAddress, AtlanticProvince } from "@/lib/locations/address";

/** Which provinces each Atlantic area code serves. */
const AREA_CODE_PROVINCES: Record<string, AtlanticProvince[]> = {
  "506": ["NB"],
  "428": ["NB"],
  "902": ["NS", "PE"],
  "782": ["NS", "PE"],
  "709": ["NL"],
  "879": ["NL"],
};
const TOLL_FREE = new Set(["800", "833", "844", "855", "866", "877", "888"]);
const POSTAL_ANY = /\b[ABCE]\d[A-Z][ -]?\d[A-Z]\d\b/gi;

/** Matches any North American phone number written in the usual ways. */
const ANY_PHONE = /(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g;

function phonePattern(digits10: string): RegExp {
  const a = digits10.slice(0, 3);
  const b = digits10.slice(3, 6);
  const c = digits10.slice(6);
  return new RegExp(`(?:\\+?1[-. ]?)?\\(?${a}\\)?[-. ]?${b}[-. ]?${c}(?!\\d)`);
}

/**
 * Works out which office a phone number belongs to from the text right before it.
 *
 * Contact pages usually list offices like
 *   "Moncton, NB – 1350 Aviation Ave, Dieppe, NB E1A 9A3. (506) 858-5688"
 * so we look back from the number to the previous phone number (or ~180 characters)
 * and take the first town written as part of an address ("Moncton, NB").
 */
export function officeForPhone(pageText: string | null | undefined, phone: string): string | null {
  if (!pageText) return null;
  const digits = phone.replace(/\D/g, "");
  const digits10 = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (digits10.length !== 10) return null;

  const text = pageText.replace(/\s+/g, " ");
  const hit = phonePattern(digits10).exec(text);
  if (!hit) return null;

  const before = text.slice(Math.max(0, hit.index - 180), hit.index);
  // Don't look past the previous phone number: that text belongs to another office.
  const lastPhoneInWindow = [...before.matchAll(ANY_PHONE)].pop();
  const segment = lastPhoneInWindow ? before.slice((lastPhoneInWindow.index ?? 0) + lastPhoneInWindow[0].length) : before;

  // Layout 1 — "…Moncton, N.B. E1A 6N5  View on Map  Truro (902) 897-2717": a town written
  // after the previous office's postal code is this number's heading.
  const postals = [...segment.matchAll(POSTAL_ANY)];
  const lastPostal = postals.pop();
  // Only the last address block counts: text before an earlier postal code is another office.
  const previousPostal = postals.pop();
  const block = previousPostal ? segment.slice((previousPostal.index ?? 0) + previousPostal[0].length) : segment;
  const tail = lastPostal ? segment.slice((lastPostal.index ?? 0) + lastPostal[0].length) : "";
  const heading = lastPostal ? findKnownPlaces(tail).pop()?.place ?? null : null;

  // Layout 2 — "Moncton, NB – 1350 Aviation Ave, Dieppe, NB E1A 9A3. (506) 858-5688":
  // the first town written as part of an address.
  const office = heading ?? findKnownPlaces(block, { requireProvince: true })[0]?.place ?? null;
  if (!office) return null;

  // Sanity check with the area code: a Maine (207) number is not the Dartmouth office.
  const areaCode = digits10.slice(0, 3);
  if (TOLL_FREE.has(areaCode)) return office;
  const areaProvinces = AREA_CODE_PROVINCES[areaCode];
  if (!areaProvinces) return null;
  const province = heading ? null : parseAtlanticAddress(block).province;
  if (province && !areaProvinces.includes(province)) return null;
  return office;
}

/** True when the office town is the supplier's listed city or one of its nearby towns. */
export function isHomeOffice(office: string | null, homeCity: string | null | undefined): boolean {
  if (!office || !homeCity) return false;
  const towns = metroTowns(homeCity).map((t) => t.toLowerCase());
  return towns.includes(office.toLowerCase()) || office.toLowerCase() === homeCity.toLowerCase();
}

const DEPARTMENTS: { label: string; re: RegExp }[] = [
  { label: "24/7 emergency", re: /\b(?:24\s*\/\s*7|24\s*hours?|emergency|after[\s-]?hours)\b/i },
  { label: "Toll-free", re: /\btoll[\s-]?free\b/i },
  { label: "Sales", re: /\bsales\b/i },
  { label: "Service", re: /\bservice(?:\s+department)?\b/i },
  { label: "Parts", re: /\bparts\b/i },
  { label: "Estimating", re: /\b(?:estimating|quotes?)\b/i },
  { label: "Dispatch", re: /\bdispatch\b/i },
  { label: "Rentals", re: /\brentals?\b/i },
  { label: "Shop", re: /\b(?:shop|plant|warehouse)\b/i },
  { label: "Head office", re: /\b(?:head\s+office|corporate\s+office|headquarters)\b/i },
];

/**
 * What the number is for, from the words just before it ("24/7 Parts: (506) 461-0480" →
 * "24/7 emergency · Parts"). Returns null when the page gives no label.
 */
export function departmentForPhone(pageText: string | null | undefined, phone: string): string | null {
  if (!pageText) return null;
  const digits = phone.replace(/\D/g, "");
  const digits10 = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (digits10.length !== 10) return null;
  const text = pageText.replace(/\s+/g, " ");
  const hit = phonePattern(digits10).exec(text);
  if (!hit) return null;
  // Only the label right before the number, and never past the previous number.
  let before = text.slice(Math.max(0, hit.index - 40), hit.index);
  const prev = [...before.matchAll(ANY_PHONE)].pop();
  if (prev) before = before.slice((prev.index ?? 0) + prev[0].length).replace(/^\s*\([^)]*\)/, "");
  // Cut at the end of the previous address or sentence.
  before = before.split(/[.;|•]|\b[ABCE]\d[A-Z][ -]?\d[A-Z]\d\b/i).pop() || "";
  const labels = DEPARTMENTS.filter((d) => d.re.test(before)).map((d) => d.label);
  return labels.length ? labels.slice(0, 2).join(" · ") : null;
}

const PROVINCE_SLUGS: Record<string, string> = {
  "new-brunswick": "New Brunswick",
  "nova-scotia": "Nova Scotia",
  "prince-edward-island": "Prince Edward Island",
  pei: "Prince Edward Island",
  newfoundland: "Newfoundland & Labrador",
  "newfoundland-and-labrador": "Newfoundland & Labrador",
  "newfoundland-labrador": "Newfoundland & Labrador",
  labrador: "Labrador",
  quebec: "Quebec",
  ontario: "Ontario",
  alberta: "Alberta",
  "british-columbia": "British Columbia",
  manitoba: "Manitoba",
  saskatchewan: "Saskatchewan",
};

function titleFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/\.(?:html?|php|aspx?)$/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 && /^(?:nb|ns|nl|pe)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Office name from the page the number was found on: /locations/bishops-falls → "Bishops Falls",
 * /new-brunswick → "New Brunswick". Null for pages that are not about one place.
 */
export function officeFromSourceUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let parts: string[];
  try {
    parts = new URL(url).pathname.toLowerCase().split("/").filter(Boolean);
  } catch {
    return null;
  }
  const last = parts[parts.length - 1];
  if (!last) return null;
  if (PROVINCE_SLUGS[last]) return PROVINCE_SLUGS[last]!;
  const parent = parts[parts.length - 2];
  if (parent && /^(?:locations?|branches|branch|offices?|stores?|dealers?|service-centres?|service-centers?|facilities)$/.test(parent)) {
    return titleFromSlug(last);
  }
  return null;
}

/** Any town written as "Town, NB" / "Town NS" right before the number, even if not in our town list. */
export function townBeforePhone(pageText: string | null | undefined, phone: string): string | null {
  if (!pageText) return null;
  const digits = phone.replace(/\D/g, "");
  const digits10 = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (digits10.length !== 10) return null;
  const text = pageText.replace(/\s+/g, " ");
  const hit = phonePattern(digits10).exec(text);
  if (!hit) return null;
  let before = text.slice(Math.max(0, hit.index - 160), hit.index);
  const prev = [...before.matchAll(ANY_PHONE)].pop();
  if (prev) before = before.slice((prev.index ?? 0) + prev[0].length);
  const towns = [...before.matchAll(/([A-Z][a-z'’]+(?:[ -](?:[A-Z][a-z'’]+|de|du|la))*),?\s+(?:NB|NS|PE|PEI|NL|N\.B\.|N\.S\.|New Brunswick|Nova Scotia|Newfoundland)\b/g)];
  const town = towns.pop()?.[1];
  return town && town.length <= 30 ? town : null;
}

/** Last-resort label from the area code, so no number is shown as just "Phone". */
export function regionForAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const ac = (digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits).slice(0, 3);
  if (TOLL_FREE.has(ac)) return "Toll-free line";
  if (ac === "506" || ac === "428") return "New Brunswick line";
  if (ac === "902" || ac === "782") return "Nova Scotia / PEI line";
  if (ac === "709" || ac === "879") return "Newfoundland & Labrador line";
  return "Out-of-province line";
}
