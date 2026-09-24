import * as cheerio from "cheerio";

export type PageClassification =
  | "HOME"
  | "ABOUT"
  | "SERVICES"
  | "CAPABILITIES"
  | "PRODUCTS"
  | "INDUSTRIES"
  | "EQUIPMENT"
  | "CERTIFICATIONS"
  | "PROJECTS"
  | "CONTACT"
  | "LOCATION"
  | "OTHER";

export interface DiscoveredLink {
  url: string;
  classification: PageClassification;
  anchorText?: string;
}

const IGNORED_PATH_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/signup/i,
  /\/register/i,
  /\/search/i,
  /\/cart/i,
  /\/checkout/i,
  /\/calendar/i,
  /\/tag\//i,
  /\/category\//i,
  /\/page\/\d+/i,
  /\.pdf$/i,
  /\.zip$/i,
  /\.png$/i,
  /\.jpg$/i,
  /\.jpeg$/i,
  /\.(?:gif|webp|svg|mp4|mov|docx?|xlsx?|pptx?|ics|xml|json|rss)$/i,
  /\/(?:wp-login|wp-admin|wp-json|feed|xmlrpc)/i,
  /\/(?:privacy|terms|cookie|legal|disclaimer|accessibility|sitemap)/i,
  /\/(?:careers?|jobs?|employment|join-our-team|work-with-us)(?:\/|$|-)/i,
  /\/(?:blog|news|press|events?)\/[^/]+/i,
  /\/(?:fr|fr-ca|es)(?:\/|$)/i,
  /\/(?:collections|product|products|shop|store)\/[^/]+/i,
];

/** Same-site key: www/non-www, trailing slash and index pages count as one page. */
function dedupeKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "").replace(/\/index\.(?:html?|php|aspx?)$/i, "") || "/";
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${path.toLowerCase()}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Normalizes a URL string by resolving against base URL, removing hashes,
 * converting domain to lowercase, and stripping tracking parameters.
 */
export function normalizeUrl(urlStr: string, baseUrlStr: string): string | null {
  try {
    const resolved = new URL(urlStr, baseUrlStr);

    // Strip hash fragment
    resolved.hash = "";

    // Strip common tracking query params
    const searchParams = resolved.searchParams;
    const trackingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ref"];
    for (const key of trackingKeys) {
      searchParams.delete(key);
    }

    // Standardize trailing slash for root domain
    if (resolved.pathname === "") {
      resolved.pathname = "/";
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

export function isSameRegistrableDomain(urlA: string, urlB: string): boolean {
  try {
    const hostA = new URL(urlA).hostname.toLowerCase().replace(/^www\./, "");
    const hostB = new URL(urlB).hostname.toLowerCase().replace(/^www\./, "");
    return hostA === hostB || hostA.endsWith(`.${hostB}`) || hostB.endsWith(`.${hostA}`);
  } catch {
    return false;
  }
}

export function classifyUrl(urlStr: string, anchorText: string = ""): PageClassification {
  const textLower = anchorText.toLowerCase();
  const path = new URL(urlStr).pathname.toLowerCase();

  if (path === "/" || path === "") return "HOME";

  // Match whole path words, so "/contactors" (a product) is not a contact page.
  const words = path.split(/[^a-z0-9]+/).filter(Boolean);
  const pathHas = (...stems: string[]) => words.some((w) => stems.some((s) => w === s || w.startsWith(s)));
  const pathHasExact = (...terms: string[]) => words.some((w) => terms.includes(w));
  const textHas = (rx: RegExp) => rx.test(textLower);

  if (pathHas("about", "company", "who", "history") || textHas(/\babout\b/)) return "ABOUT";
  if (pathHas("service") || textHas(/\bservices?\b/)) return "SERVICES";
  if (pathHas("capabilit", "expertise", "specialt", "what") || textHas(/\bcapabilit/)) return "CAPABILITIES";
  if (pathHas("product") || textHas(/\bproducts?\b/)) return "PRODUCTS";
  if (pathHas("industr", "markets", "sectors") || textHas(/\bindustr/)) return "INDUSTRIES";
  if (pathHas("equip", "machin", "facilit", "fleet") || textHas(/\bequipment\b/)) return "EQUIPMENT";
  if (pathHas("certif", "quality", "accreditation") || textHas(/\bcertif/)) return "CERTIFICATIONS";
  if (pathHas("project", "portfolio", "gallery", "work") || textHas(/\bprojects?\b/)) return "PROJECTS";
  if (pathHasExact("contact", "contacts", "contactus", "contact-us") || pathHas("contact-us", "get-in-touch") || textHas(/\bcontact\b/)) return "CONTACT";
  if (pathHas("location", "branch", "office") || pathHasExact("plant", "plants") || textHas(/\blocations?\b/)) return "LOCATION";

  return "OTHER";
}

export function discoverHighValueLinks(
  html: string,
  baseUrl: string,
  maxPages: number = 20
): DiscoveredLink[] {
  const $ = cheerio.load(html);
  const discovered: Map<string, DiscoveredLink> = new Map();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const anchorText = $(el).text().trim();

    if (!href) return;

    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized) return;
    if (!/^https?:/i.test(normalized)) return;
    if (/[?&]lang=fr\b/i.test(normalized)) return;

    if (!isSameRegistrableDomain(normalized, baseUrl)) return;

    // Check path ignore patterns
    const path = new URL(normalized).pathname;
    if (IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(path))) return;

    const classification = classifyUrl(normalized, anchorText);

    const key = dedupeKey(normalized);
    if (key === dedupeKey(baseUrl)) return;
    if (!discovered.has(key)) {
      discovered.set(key, {
        url: normalized,
        classification,
        anchorText,
      });
    }
  });

  // Prioritize high-value classifications (CONTACT & LOCATION first for RFQ contact coverage)
  const priorityOrder: PageClassification[] = [
    "CONTACT",
    "LOCATION",
    "SERVICES",
    "CAPABILITIES",
    "ABOUT",
    "EQUIPMENT",
    "CERTIFICATIONS",
    "INDUSTRIES",
    "PRODUCTS",
    "PROJECTS",
    "HOME",
    "OTHER",
  ];

  const sortedLinks = Array.from(discovered.values()).sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.classification);
    const idxB = priorityOrder.indexOf(b.classification);
    if (idxA !== idxB) return idxA - idxB;
    // Within a class, shallow pages (/services) beat deep ones (/services/x/y/z).
    const depth = (u: string) => new URL(u).pathname.split("/").filter(Boolean).length;
    return depth(a.url) - depth(b.url);
  });

  return sortedLinks.slice(0, maxPages);
}
