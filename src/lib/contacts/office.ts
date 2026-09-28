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
