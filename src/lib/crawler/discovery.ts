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
];

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

  if (path.includes("about") || textLower.includes("about")) return "ABOUT";
  if (path.includes("service") || textLower.includes("service")) return "SERVICES";
  if (path.includes("capabilit") || textLower.includes("capabilit")) return "CAPABILITIES";
  if (path.includes("product") || textLower.includes("product")) return "PRODUCTS";
  if (path.includes("industr") || textLower.includes("industr")) return "INDUSTRIES";
  if (path.includes("equip") || path.includes("machin") || textLower.includes("equipment")) return "EQUIPMENT";
  if (path.includes("certif") || path.includes("quality") || textLower.includes("certif")) return "CERTIFICATIONS";
  if (path.includes("project") || path.includes("portfolio") || textLower.includes("project")) return "PROJECTS";
  if (path.includes("contact") || textLower.includes("contact")) return "CONTACT";
  if (path.includes("location") || path.includes("plant") || textLower.includes("location")) return "LOCATION";

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

    if (!isSameRegistrableDomain(normalized, baseUrl)) return;

    // Check path ignore patterns
    const path = new URL(normalized).pathname;
    if (IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(path))) return;

    const classification = classifyUrl(normalized, anchorText);

    if (!discovered.has(normalized)) {
      discovered.set(normalized, {
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
    return idxA - idxB;
  });

  return sortedLinks.slice(0, maxPages);
}
