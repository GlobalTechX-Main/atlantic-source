import { ExtractionMethodEnum } from "@prisma/client";
import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";

/**
 * Services as the company names them on its own site ("Heavy Lift & Rigging",
 * "Ice Management"), whether or not they fit our fixed capability list.
 *
 * Two deterministic sources:
 *  1. Links to the company's own service pages (/services/heavy-lift, /what-we-do/welding),
 *     usually from the site menu, so every page tends to list them.
 *  2. Section headings on the company's services page.
 */

/**
 * A page for one service: /services/heavy-lift/ (exactly one level below a services folder).
 * The folder may carry a prefix: /custom-manufacturing-capabilities/cnc-machining/.
 */
const SERVICE_HUB =
  /\/(?:[a-z0-9]+-){0,3}(?:services?|capabilities|what-we-do|solutions|expertise|specialties|specialities)\/([^/?#]+)\/?$/i;

/** A page for one product line: /our-products/fire-rated-doors/, /products/hydraulic-cylinders/. */
const PRODUCT_HUB = /\/(?:our-)?(?:products?|product-lines?|product-range)\/([^/?#]+)\/?$/i;

/** Words that on their own are section titles, not services. */
const GENERIC = new Set(
  [
    "services", "service", "our services", "all services", "view all services", "other services", "service department",
    "expertise", "our expertise", "capabilities", "our capabilities", "solutions", "our solutions", "what we do",
    "industries", "industries served", "markets", "sectors", "projects", "featured projects", "our projects", "portfolio",
    "about", "about us", "who we are", "our story", "history", "our history", "mission", "our mission", "values", "our values",
    "contact", "contact us", "get in touch", "quick links", "request a quote", "get a quote", "free quote", "learn more",
    "read more", "view more", "see more", "view all", "more", "home", "overview", "careers", "join our team", "news", "blog",
    "events", "testimonials", "reviews", "faq", "faqs", "locations", "our locations", "gallery", "photos", "videos",
    "why choose us", "our team", "team", "leadership", "partners", "our partners", "clients", "safety", "quality",
    "sustainability", "community", "innovation", "design", "manufacture", "support", "resources", "downloads",
    "privacy policy", "terms", "sitemap", "search", "menu", "login", "sign in", "english", "français", "francais",
    "service areas", "areas we serve", "proud members of", "certifications", "equipment", "our equipment", "fleet",
    "details", "view details", "products", "our products", "all products", "view products", "shop now", "buy now", "brands", "new",
  ].map((s) => s.toLowerCase())
);

/** Calls to action and questions, not service names. */
const CALL_TO_ACTION = /^(?:request|find|explore|go|learn|discover|get|contact|call|view|see|read|click|book|schedule|download|subscribe|why|how|what|where|when|who|frequently|meet|join|watch|browse|shop)\b/i;

/** Industry names that sites list next to their services ("Mining", "Oil & Gas"). */
const INDUSTRY_ONLY = /^(?:agriculture|aquaculture|fisheries|food(?: processing)?|forestry|pulp(?: and| &)? paper|mining|oil(?: and| &)? gas|energy|utilities|renewables?|power generation|wind|solar|marine|military|defen[cs]e|aerospace|automotive|transportation|healthcare|government|municipal|institutional|commercial|residential|industrial|manufacturing|construction|infrastructure|technology|retail|education|mining trucks)\b/i;
const SERVICE_WORD = /\b(?:services?|repairs?|machining|fabrication|installation|maintenance|testing|inspection|design|engineering|welding|rentals?|transport(?:ation)?|towing|rigging|lifting|cutting|bending|plating|grinding|coating|painting|blasting|construction|demolition|paving|drilling|consulting|management|automation|programming|electrical|mechanical|plumbing|hvac|piping|assessment|analysis|monitoring|commissioning|support|removal|supply|manufacturing|assembly|training|calibration|cleaning|salvage|rescue|driving|excavation|surveying|planning|architecture|remediation|lighting|integration|contracting|upgrades?|retrofits?|panels?|systems?|shutdowns?|turnarounds?)\b/i;

/** Marketing words, documents and language switches that are never a service name. */
const NOT_A_SERVICE =
  /\b(?:great|premier|world[- ]class|proven|success|excellent|best|leading|trusted|award|brochure|flyer|fact sheet|line card|portal|a-z|news|fran[cç]ais|french|english|español|preventing|facility in|website|configurator|advantage|benefits of|roi)\b|@|_|[àâçéèêëîïôûùüÿœ]/i;
/** Archive links ("April 2014") and bare years. */
const DATE_LIKE = /^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}$/i;
const REGION_ONLY = /^(?:atlantic|atlantic canada|canada|maritimes|ontario|quebec|national|international|global)$/i;

const PRONOUN = /\b(?:we|our|ours|you|your|us|i|my|me)\b/i;
const PLACE_OR_OFFICE = /\b(?:new brunswick|nova scotia|prince edward island|newfoundland|labrador|head office|office|location|branch)\b/i;
const FUNCTION_WORD = /\b(?:the|of|to|for|with|on|in|at|every|from|by|is|are|be|has|have|will|can|that|this)\b/gi;

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(And|Of|For|The|To|In|On|With)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (m) => m.toUpperCase());
}

/** Cleans a candidate and returns it when it reads like a service name, else null. */
export function cleanServiceName(raw: string, options: { underServicesFolder?: boolean } = {}): string | null {
  const text = raw
    .replace(/[\s\u00a0\u200b]+/g, " ")
    .replace(/^[\s\-–—•·>»›|]+|[\s\-–—•·>»›|+]+$/g, "")
    .replace(/\s+(?:[Aa]t|[Ii]n|[Aa]cross)\s+[A-Z][\w&'’ -]*$/, "")
    .trim();
  if (text.length < 3 || text.length > 60) return null;
  const words = text.split(" ");
  if (words.length > 7) return null;
  if (/[?!.:;,]$/.test(text) || /^\d/.test(text) || !/[a-z]/i.test(text)) return null;
  if (/%%|[{}<>]/.test(text) || /^[a-z]/.test(text) || CALL_TO_ACTION.test(text)) return null;
  // "Marine" or "Mining" on its own is usually an industry list. But when the company files it
  // under its own services folder (/services/marine/), it is how they name that service line.
  if (!options.underServicesFolder && INDUSTRY_ONLY.test(text) && !SERVICE_WORD.test(text)) return null;
  if (NOT_A_SERVICE.test(text) || REGION_ONLY.test(text) || DATE_LIKE.test(text) || /^['"‘’“”]/.test(text)) return null;
  if (/^[A-Z]$/.test(text)) return null;
  if (PRONOUN.test(text) || PLACE_OR_OFFICE.test(text)) return null;
  if ((text.match(FUNCTION_WORD) || []).length >= 2) return null;
  const key = text.toLowerCase().replace(/^our\s+/, "our ");
  if (GENERIC.has(key) || GENERIC.has(key.replace(/^our\s+/, ""))) return null;
  return titleCase(text);
}

/** Lower-case comparison key: "Heavy Lift & Rigging" and "HEAVY LIFT AND RIGGING" are the same service. */
export function serviceKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/s\b/g, "");
}

function sameSite(href: string, pageUrl: string): boolean {
  try {
    const a = new URL(href).hostname.replace(/^www\./, "");
    const b = new URL(pageUrl).hostname.replace(/^www\./, "");
    return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
  } catch {
    return false;
  }
}

/**
 * Menu groups that are site housekeeping, not what the company sells: about, contact, jobs,
 * news, projects, certifications, industries, fleet/equipment and so on. Everything else in
 * a dropdown menu is treated as the company's own list of offerings, whatever it is called.
 */
const HOUSEKEEPING_MENU =
  /\b(?:about|company|who we are|our story|history|team|leadership|management team|contact|careers?|jobs?|employment|join|news|blog|media|press|events?|resources|downloads?|investors?|log ?in|sign ?in|account|locations?|branches|offices?|faq|legal|privacy|polic(?:y|ies)|our work|projects?|case stud(?:y|ies)|portfolio|gallery|testimonials?|certif\w*|quality|affiliations?|accreditations?|industr(?:y|ies)|markets?|sectors?|clients?|customers?|partners?|community|sustainab\w*|safety|environment\w*|language|fleet|equipment|videos?|home|insights|supplier resources|customer resources|articles?|tips|learn|knowledge|library|guides?|hiring|postings?|opportunities|openings|positions|vacancies|français|francais|english)\b/i;
const PRODUCT_MENU = /\b(?:products?|product lines?|catalog(?:ue)?|shop|store|brands?)\b/i;

const SERVICE_PAGE_URL = /\/(?:[a-z0-9]+-){0,3}(?:services?|capabilities|what-we-do|solutions|expertise|specialties|specialities)\/?$/i;

export class ListedServiceExtractor implements BaseExtractor {
  public name = "LISTED_SERVICE_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const found = new Map<string, ExtractedClaimCandidate>();
    const add = (name: string, evidence: string, locator: string, confidence: number, type: "SERVICE_LISTED" | "PRODUCT_LISTED" = "SERVICE_LISTED") => {
      const k = `${type}:${serviceKey(name)}`;
      const prev = found.get(k);
      if (prev && prev.confidence >= confidence) return;
      found.set(k, {
        claimType: type,
        rawValue: name,
        normalizedValue: serviceKey(name).replace(/ /g, "-"),
        evidenceText: evidence,
        evidenceLocator: locator,
        extractionMethod: ExtractionMethodEnum.PAGE_STRUCTURE,
        confidence,
      });
    };

    // 1. Links to the company's own service pages.
    for (const link of input.links || []) {
      if (!sameSite(link.href, input.sourceUrl)) continue;
      let path = "";
      try {
        path = new URL(link.href).pathname;
      } catch {
        continue;
      }
      const isService = SERVICE_HUB.test(path);
      const isProduct = !isService && PRODUCT_HUB.test(path);
      if (!isService && !isProduct) continue;
      const name = cleanServiceName(link.text, { underServicesFolder: true });
      if (!name) continue;
      // Catalogue items with model numbers ("Breaker Qo 15a 1p 120v") are single products, not product lines.
      if (isProduct && name.split(" ").some((w) => /\d/.test(w))) continue;
      if (isService) add(name, `Link to the company's service page "${name}" → ${link.href}`, "SERVICE_PAGE_LINK", 0.9);
      else add(name, `Link to the company's product page "${name}" → ${link.href}`, "PRODUCT_PAGE_LINK", 0.9, "PRODUCT_LISTED");
    }

    // 1b. Dropdown / mega-menu groups, read by structure instead of by folder name: a group of
    //     links under a menu item that is not housekeeping is the company's list of offerings.
    for (const group of input.menuGroups || []) {
      if (group.trail.length === 0) continue; // the top menu bar itself only names site sections
      if (group.trail.some((label) => HOUSEKEEPING_MENU.test(label))) continue;
      const sameSiteLinks = group.links.filter((l) => sameSite(l.href, input.sourceUrl));
      if (sameSiteLinks.length < 2 || sameSiteLinks.length < group.links.length * 0.6) continue;
      // An item that is itself a housekeeping page ("Contacts", "Health & Safety") is dropped,
      // and a group made mostly of them is an "about us" menu, not a list of offerings.
      const housekeepingItems = sameSiteLinks.filter((l) => HOUSEKEEPING_MENU.test(l.text) && !SERVICE_WORD.test(l.text)).length;
      if (housekeepingItems / sameSiteLinks.length > 0.4) continue;
      const names = sameSiteLinks
        .filter((l) => !(HOUSEKEEPING_MENU.test(l.text) && !SERVICE_WORD.test(l.text)))
        .map((l) => cleanServiceName(l.text));
      const good = names.filter((n): n is string => Boolean(n));
      // Mostly real names (not "Capabilities / Our Work / Certifications" section links).
      if (good.length < 2 || good.length / sameSiteLinks.length < 0.6) continue;
      const isProduct = group.trail.some((label) => PRODUCT_MENU.test(label));
      const where = group.trail.join(" › ");
      for (const name of good) {
        if (isProduct && name.split(" ").some((w) => /\d/.test(w))) continue;
        add(
          name,
          `Listed in the site menu under "${where}" on ${input.sourceUrl}`,
          "MENU_GROUP",
          0.85,
          isProduct ? "PRODUCT_LISTED" : "SERVICE_LISTED"
        );
      }
    }

    // 1c. This page is one of a set of sibling pages that read like services or products:
    //     its own main heading names one offering.
    if (input.collectionKind === "SERVICE" || input.collectionKind === "PRODUCT") {
      const h1 = input.headings.find((h) => h.level === "h1")?.text;
      const titleName = (input.pageTitle || "").split(/\s+(?:[|–—-]|::)\s+/)[0];
      const rawName = (h1 || titleName || "").split(/\s+(?:[|–—]|::)\s+/)[0] || "";
      const name = HOUSEKEEPING_MENU.test(rawName) && !SERVICE_WORD.test(rawName) ? null : cleanServiceName(rawName);
      if (name) {
        add(
          name,
          `Page ${input.sourceUrl} is one of several similar pages that describe ${input.collectionKind === "SERVICE" ? "services" : "products"}`,
          "PAGE_COLLECTION",
          0.85,
          input.collectionKind === "SERVICE" ? "SERVICE_LISTED" : "PRODUCT_LISTED"
        );
      }
    }

    // 2. The services page: its section headings name the services. A page for one
    //    service (/services/heavy-lift/) names it in its main heading.
    let path = "/";
    try {
      path = new URL(input.sourceUrl).pathname;
    } catch {
      // keep "/"
    }
    const isOneServicePage = SERVICE_HUB.test(path);
    const isServicesHub =
      !isOneServicePage && (input.pageType === "SERVICES" || input.pageType === "CAPABILITIES" || SERVICE_PAGE_URL.test(path));
    if (isOneServicePage) {
      const h1 = input.headings.find((h) => h.level === "h1");
      const name = h1 ? cleanServiceName(h1.text, { underServicesFolder: true }) : null;
      if (name) add(name, `Main heading of the service page ${input.sourceUrl}: "${h1!.text.trim()}"`, "SERVICE_PAGE_TITLE", 0.9);
    } else if (isServicesHub) {
      for (const h of input.headings) {
        if (h.level !== "h2" && h.level !== "h3") continue;
        const name = cleanServiceName(h.text);
        if (!name) continue;
        // Headings that name a kind of work are services; others ("Recognized know-how") go to review.
        add(name, `Heading on the services page ${input.sourceUrl}: "${h.text.trim()}"`, `services_page_${h.level}`, SERVICE_WORD.test(name) ? 0.85 : 0.6);
      }
    }

    // 3. A list of short lines on the services page ("Estimating / Budgeting / Permitting / ...").
    //    Only when nothing clearer was found, and always checked by review: such lists also
    //    hold products, clients, staff names and amenities.
    if (isServicesHub && found.size < 3) {
      const lines = (input.contentText ?? "").split("\n").map((l) => l.trim());
      let run: string[] = [];
      const flush = () => {
        const names = run.map((l) => cleanServiceName(l));
        const good = names.filter((n): n is string => Boolean(n));
        if (run.length >= 4 && good.length / run.length >= 0.7) {
          for (const n of good.slice(0, 25)) add(n, `Listed on the services page ${input.sourceUrl}: "${n}"`, "services_page_list", 0.8);
        }
        run = [];
      };
      for (const line of lines) {
        const words = line.split(" ").length;
        if (line && words <= 6 && line.length <= 60 && !/[.!?]$/.test(line)) run.push(line);
        else flush();
      }
      flush();
    }

    const all = [...found.values()];
    return [...all.filter((c) => c.claimType === "SERVICE_LISTED").slice(0, 40), ...all.filter((c) => c.claimType === "PRODUCT_LISTED").slice(0, 40)];
  }
}
