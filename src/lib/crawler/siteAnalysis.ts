/**
 * Checks that look at a crawled website as a whole rather than one page at a time:
 * - is this still the supplier's own website (not parked, for sale, hijacked or blocked)?
 * - which pages are duplicates of each other?
 * - which lines repeat on most pages (menus, footers, banners) and should not count as evidence?
 */

export interface SitePageSummary {
  url: string;
  title: string;
  fullText: string;
  contentText: string;
  jsonLdScripts: string[];
  openGraph?: Record<string, string>;
  mailtoLinks: string[];
}

export type SiteIdentityStatus = "OK" | "PARKED_OR_SPAM" | "BLOCKED" | "NAME_NOT_FOUND" | "EMPTY";

export interface SiteIdentityResult {
  status: SiteIdentityStatus;
  reason: string;
}

/** A key that treats www/non-www, trailing slashes and fragments as the same page. */
export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "").replace(/\/index\.(?:html?|php|aspx?)$/i, "") || "/";
    return `${host}${path.toLowerCase()}${u.search}`;
  } catch {
    return url.toLowerCase();
  }
}

const PARKED_OR_SPAM = [
  /\bslot\s*(?:gacor|online|88)\b/i,
  /\b(?:judi|togel|bandar)\s+(?:online|bola|slot)\b/i,
  /\bsitus\s+(?:slot|judi)\b/i,
  /\bonline\s+casino\b/i,
  /\bcasino\s+(?:bonus|games)\b/i,
  /\bdomain\s+(?:name\s+)?(?:is\s+|may\s+be\s+)?for\s+sale\b/i,
  /\b(?:buy|purchase|make\s+an\s+offer\s+on)\s+this\s+domain\b/i,
  /\bthis\s+domain\s+(?:name\s+)?(?:is|has\s+been|may\s+be)\s+(?:for\s+sale|registered|parked)\b/i,
  /\bparked\s+(?:free|domain)\b/i,
  /\b(?:hugedomains|sedo\.com|dan\.com|afternic|godaddy\s+auctions)\b/i,
  /\b(?:spaceship\.com)\b.*\bfor\s+sale\b/i,
  /\baccount\s+(?:has\s+been\s+)?suspended\b/i,
  /\bdefault\s+web\s+(?:site\s+)?page\b/i,
  /\bwebsite\s+(?:is\s+)?(?:coming\s+soon|under\s+construction)\b/i,
];

const BLOCKED = [
  /^just a moment\.\.\.$/i,
  /\bchecking\s+(?:if\s+the\s+site\s+connection\s+is\s+secure|your\s+browser)\b/i,
  /\benable\s+javascript\s+and\s+cookies\s+to\s+continue\b/i,
  /\battention\s+required!?\s*\|\s*cloudflare\b/i,
  /\baccess\s+denied\b/i,
];

const NAME_STOP_WORDS = new Set([
  "ltd", "limited", "inc", "incorporated", "corp", "corporation", "co", "company", "the", "and", "of", "des", "et",
  "group", "groupe", "industrial", "industries", "services", "service", "enterprises", "enterprise", "engineering",
  "engineers", "contractors", "contractor", "construction", "equipment", "international", "canada", "canadian",
  "atlantic", "maritime", "consulting", "solutions", "systems", "manufacturing", "products", "infrastructure",
]);

function normalizeForNameMatch(text: string): string {
  return text
    .toLowerCase()
    // "A.L.P.A." -> "alpa", "B&M" stays "b and m"
    .replace(/\b(?:[a-z]\.){2,}(?:[a-z]\b)?/g, (m) => m.replace(/\./g, ""))
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9À-ɏ]+/g, " ")
    .trim();
}

/** Distinctive words of a company name, e.g. "Ocean Steel & Construction" -> ["ocean", "steel"]. */
export function distinctiveNameTokens(companyName: string): string[] {
  const tokens = normalizeForNameMatch(companyName).split(" ").filter(Boolean);
  const distinctive = tokens.filter((t) => t.length >= 3 && !NAME_STOP_WORDS.has(t));
  return distinctive.length > 0 ? distinctive : tokens.filter((t) => t.length >= 3);
}

export function checkSiteIdentity(companyName: string, supplierDomain: string | null | undefined, pages: SitePageSummary[]): SiteIdentityResult {
  const usable = pages.filter((p) => (p.fullText || "").trim().length > 0 || p.title);
  if (usable.length === 0) {
    return { status: "EMPTY", reason: "No readable pages were returned by the website" };
  }

  const home = usable[0]!;
  const homeProbe = `${home.title}\n${home.fullText.slice(0, 4000)}`;
  if (BLOCKED.some((rx) => rx.test(home.title.trim()) || rx.test(homeProbe)) && home.fullText.length < 2000) {
    return { status: "BLOCKED", reason: "The website blocked the crawler (bot protection or access denied page)" };
  }

  const spamHits = usable.filter((p) => PARKED_OR_SPAM.some((rx) => rx.test(`${p.title}\n${p.fullText.slice(0, 6000)}`)));
  if (spamHits.length > 0 && spamHits.length >= Math.ceil(usable.length / 2)) {
    return {
      status: "PARKED_OR_SPAM",
      reason: `The website no longer looks like the supplier's own site (parked, for sale or unrelated content): "${spamHits[0]!.title.slice(0, 80)}"`,
    };
  }

  const tokens = distinctiveNameTokens(companyName);
  const haystack = normalizeForNameMatch(
    usable
      .map((p) => [p.title, p.fullText.slice(0, 20000), p.openGraph?.site_name || "", p.jsonLdScripts.join(" ").slice(0, 5000)].join(" "))
      .join(" ")
  );
  const paddedHaystack = ` ${haystack} `;
  const nameFound = tokens.some((t) => paddedHaystack.includes(` ${t} `));

  const domain = (supplierDomain || "").toLowerCase().replace(/^www\./, "");
  const domainEmailFound =
    domain.length > 0 &&
    usable.some((p) => p.mailtoLinks.some((e) => e.toLowerCase().endsWith(`@${domain}`)) || p.fullText.toLowerCase().includes(`@${domain}`));

  if (!nameFound && !domainEmailFound) {
    return {
      status: "NAME_NOT_FOUND",
      reason: `None of the pages mention "${companyName}" (looked for: ${tokens.join(", ")}). The domain may now belong to another company.`,
    };
  }

  return { status: "OK", reason: nameFound ? "Company name found on the website" : "Company email domain found on the website" };
}

/**
 * Lines that appear on at least `minShare` of the site's pages (and on at least 3 pages)
 * are site furniture: menus, footers, banners, repeated calls to action.
 */
export function findRepeatedLines(contentTexts: string[], minShare = 0.5): Set<string> {
  const repeated = new Set<string>();
  if (contentTexts.length < 3) return repeated;
  const counts = new Map<string, number>();
  for (const text of contentTexts) {
    const seenOnPage = new Set<string>();
    for (const line of text.split("\n")) {
      const key = line.trim().toLowerCase();
      if (key.length < 3 || seenOnPage.has(key)) continue;
      seenOnPage.add(key);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(contentTexts.length * minShare));
  for (const [line, count] of counts) {
    if (count >= threshold) repeated.add(line);
  }
  return repeated;
}

export function removeRepeatedLines(text: string, repeated: Set<string>): string {
  if (repeated.size === 0) return text;
  return text
    .split("\n")
    .filter((line) => !repeated.has(line.trim().toLowerCase()))
    .join("\n");
}
