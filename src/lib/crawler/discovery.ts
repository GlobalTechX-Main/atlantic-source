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

/**
 * Full-site crawl: skip only what is never a company page (files, logins, carts, feeds,
 * legal pages, tag/archive listings and the French copy of the site). Blog, news, careers,
 * product and project pages ARE read.
 */
const FULL_CRAWL_IGNORED = [
  /\/(?:login|signin|sign-in|signup|register|my-account|account|logout|search|cart|checkout|basket|wishlist|compare)(?:\/|$|\?)/i,
  /\/(?:tag|tags|category|categories|author|archives?)\//i,
  /\/page\/\d+/i,
  /\.(?:pdf|zip|rar|png|jpe?g|gif|webp|svg|ico|mp[34]|mov|avi|wmv|docx?|xlsx?|pptx?|ics|xml|json|rss|css|js|dwg|dxf|stp|step|exe|dmg)$/i,
  /\/(?:wp-login|wp-admin|wp-json|wp-content|wp-includes|feed|xmlrpc|cdn-cgi)(?:\/|$|\.)/i,
  /\/(?:privacy|terms|cookie|legal|disclaimer|accessibility)(?:[-_/]|$)/i,
  /\/(?:fr|fr-ca|fr_ca|es)(?:\/|$)/i,
  /\/(?:print|share|email-protection)(?:\/|$)/i,
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
  // A folder named for services (/services, /our-services, /products-services), not a product
  // whose name contains the word ("/Extreme-Service-Dig-Bucket").
  const segments = path.split("/").filter(Boolean);
  const serviceFolder = segments.some((seg) => /^(?:our-)?(?:[a-z]+-)?services?(?:-|$)/.test(seg) && seg.split("-").length <= 3);
  if (serviceFolder || textHas(/^(?:our\s+)?services?$/)) return "SERVICES";
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

/** Query strings that only re-sort or filter a listing, not new content. */
const NOISE_QUERY = /[?&](?:sort|order|orderby|filter|view|lang|replytocom|share|print|add-to-cart|s|q|p|page_id|attachment_id|sector|subsector|category|type|tag)=/i;

export function isCrawlableSameSiteUrl(url: string, siteUrl: string): boolean {
  if (!/^https?:/i.test(url) || !isSameRegistrableDomain(url, siteUrl)) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  // Filtered listings ("?sector=x&company=0&content=") repeat pages already read.
  if (NOISE_QUERY.test(u.search) || [...u.searchParams.keys()].length >= 2) return false;
  return !FULL_CRAWL_IGNORED.some((p) => p.test(u.pathname));
}

export function crawlKey(url: string): string {
  return dedupeKey(url);
}

/** Crawl order: contact and service pages first, product/news pages last, shallow before deep. */
const CRAWL_PRIORITY: PageClassification[] = [
  "CONTACT",
  "LOCATION",
  "SERVICES",
  "CAPABILITIES",
  "ABOUT",
  "EQUIPMENT",
  "CERTIFICATIONS",
  "INDUSTRIES",
  "HOME",
  "OTHER",
  "PROJECTS",
  "PRODUCTS",
];

export function crawlPriority(link: DiscoveredLink): number {
  const depth = (() => {
    try {
      return new URL(link.url).pathname.split("/").filter(Boolean).length;
    } catch {
      return 9;
    }
  })();
  return CRAWL_PRIORITY.indexOf(link.classification) * 100 + depth;
}

/** Every same-site page linked from this page (menus, footers and body), for a full-site crawl. */
export function discoverAllSiteLinks(html: string, pageUrl: string, siteUrl: string = pageUrl): DiscoveredLink[] {
  const $ = cheerio.load(html);
  const found = new Map<string, DiscoveredLink>();
  $("a[href], area[href], link[rel=alternate][hreflang=en][href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || /^(?:mailto|tel|javascript|data):/i.test(href.trim())) return;
    const normalized = normalizeUrl(href, pageUrl);
    if (!normalized || !isCrawlableSameSiteUrl(normalized, siteUrl)) return;
    const key = dedupeKey(normalized);
    if (found.has(key)) return;
    const anchorText = $(el).text().replace(/\s+/g, " ").trim();
    found.set(key, { url: normalized, classification: classifyUrl(normalized, anchorText), anchorText });
  });
  return [...found.values()];
}

/** Page addresses listed in a sitemap.xml (or the child sitemaps of a sitemap index). */
export function parseSitemap(xml: string): { pages: string[]; childSitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => (m[1] || "").replace(/&amp;/g, "&"));
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  return isIndex ? { pages: [], childSitemaps: locs } : { pages: locs, childSitemaps: [] };
}

/**
 * Page groups that are often most of a big site but add little (news, jobs, product
 * catalogues, project galleries, deep unclassified pages). The crawl reads a sample of
 * each instead of all of them.
 */
export type LowValueBucket = "NEWS" | "CAREERS" | "PRODUCTS" | "PROJECTS" | "DEEP_OTHER";

export const LOW_VALUE_PAGE_BUDGET: Record<LowValueBucket, number> = {
  NEWS: 5,
  CAREERS: 2,
  PRODUCTS: 15,
  PROJECTS: 8,
  DEEP_OTHER: 30,
};

export function lowValueBucket(link: DiscoveredLink): LowValueBucket | null {
  let path = "";
  try {
    path = new URL(link.url).pathname.toLowerCase();
  } catch {
    return null;
  }
  const segments = path.split("/").filter(Boolean);
  if (segments.some((s) => /^(?:blog|blogs|news|press|press-releases|media|events?|articles?|posts?|stories|insights|updates|newsroom)$/.test(s)) && segments.length >= 2) return "NEWS";
  if (segments.some((s) => /^(?:careers?|jobs?|employment|join-our-team|work-with-us|opportunities)$/.test(s))) return "CAREERS";
  if (link.classification === "PRODUCTS" && segments.length >= 2) return "PRODUCTS";
  if (link.classification === "PROJECTS" && segments.length >= 2) return "PROJECTS";
  if (link.classification === "OTHER" && segments.length >= 3) return "DEEP_OTHER";
  return null;
}
