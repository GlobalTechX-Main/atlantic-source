import type { FetchResult } from "@/lib/crawler/fetcher";
import { parseAndSanitizeHtml, ExtractedPageContent } from "@/lib/crawler/parser";
import {
  PageClassification,
  DiscoveredLink,
  discoverAllSiteLinks,
  isCrawlableSameSiteUrl,
  isSameRegistrableDomain,
  classifyUrl,
  crawlKey,
  crawlPriority,
  parseSitemap,
  lowValueBucket,
  LOW_VALUE_PAGE_BUDGET,
  LowValueBucket,
} from "@/lib/crawler/discovery";
import { checkSiteIdentity, findRepeatedLines, removeRepeatedLines, pageKey, SiteIdentityResult } from "@/lib/crawler/siteAnalysis";
import type { ExtractorInput } from "@/lib/extraction/types";

export interface CrawledPage {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  classification: PageClassification;
  parsed: ExtractedPageContent;
  /** Main content with lines that repeat across the site removed. */
  cleanContentText: string;
  /** Set when this page belongs to a set of sibling pages that read like services, products or projects. */
  collectionKind?: "SERVICE" | "PRODUCT" | "PROJECT";
}

export interface RejectedPage {
  url: string;
  reason: string;
}

export interface SiteCrawlResult {
  pages: CrawledPage[];
  rejected: RejectedPage[];
  pagesDiscovered: number;
  identity: SiteIdentityResult;
  /** The site sells products online (cart, shop by category): service words are often product categories. */
  isRetail: boolean;
  seedError?: string;
}

const RETAIL_SIGNALS = /\b(?:add\s+to\s+cart|add\s+to\s+quote\s+cart|shop\s+by\s+(?:categor(?:y|ies)|brand)|shop\s+(?:all\s+)?products|buy\s+online)\b/i;
const DISTRIBUTOR_SIGNAL = /\b(?:(?:leading|largest|independent|national|premier|major|wholesale|industrial|electrical)\s+(?:[\w&-]+\s+){0,3}distributors?|distributors?\s+of|wholesale\s+suppl(?:y|ier))\b/i;

export type PageFetcher = (url: string) => Promise<FetchResult>;

/** Most pages read per website. Set CRAWL_MAX_PAGES in .env to change it. */
export const DEFAULT_MAX_PAGES = 150;
/** @deprecated kept for older scripts; the crawl now reads the whole site up to DEFAULT_MAX_PAGES. */
export const DEFAULT_MAX_SUBPAGES = DEFAULT_MAX_PAGES;

export interface CrawlOptions {
  /** Pages fetched at the same time (default 3). */
  concurrency?: number;
  /** Pause before each page request, in milliseconds (default 0). */
  delayMs?: number;
  /** Also read the pages listed in /sitemap.xml (default true). */
  useSitemap?: boolean;
  /** How many news/jobs/product/project pages to sample (default LOW_VALUE_PAGE_BUDGET). */
  lowValueBudget?: Record<LowValueBucket, number>;
}

const COLLECTION_SIGNALS: Record<"SERVICE" | "PRODUCT" | "PROJECT", RegExp> = {
  PROJECT:
    /\b(?:project (?:value|type|cost|size|location|details|scope)|client\s*:|owner\s*:|architect\s*:|general contractor\s*:|completed(?: in)?\s+(?:19|20)\d{2}|contract value|case study)\b|\$\s?\d[\d,.]*\s*(?:m|million|k)?\b/i,
  PRODUCT:
    /\b(?:specifications?|spec sheet|data ?sheet|dimensions|model (?:no|number)|part (?:no|number)|sku|capacity|available (?:in|sizes)|sizes?\s*:|finishes|add to (?:cart|quote)|product (?:features|details|overview)|features\s*(?:&|and)\s*benefits)\b/i,
  SERVICE:
    /\b(?:we (?:offer|provide|perform|fabricate|install|repair|design|build|supply|machine|weld|maintain|service|specialize|handle|deliver|can)|our (?:team|technicians|crews?|engineers|experts|shop|staff) (?:can|will|are|have|is)|services? (?:include|we)|capabilities include|on-?site|turn-?key)\b/i,
};

/**
 * Sibling pages (/anything/heavy-lift, /anything/rigging, /anything/pile-driving) form a
 * collection. What is written on them tells whether they are services, products or projects,
 * whatever the folder is called.
 */
export function classifyPageCollections(pages: CrawledPage[]): void {
  const byParent = new Map<string, CrawledPage[]>();
  for (const page of pages) {
    let parts: string[];
    try {
      parts = new URL(page.finalUrl).pathname.split("/").filter(Boolean);
    } catch {
      continue;
    }
    // A language folder (/en/, /fr-ca/) is the site root, and top-level pages are site sections.
    const langFree = /^[a-z]{2}(?:[-_][a-z]{2})?$/i.test(parts[0] ?? "") ? parts.slice(1) : parts;
    if (langFree.length < 2) continue;
    // Folders for news, jobs, projects, industries and the like are never offerings.
    if (/\b(?:news|blog|press|events?|careers?|jobs?|projects?|portfolio|case-stud|industr|markets?|sectors?|about|team|people|locations?|contact|resources|insights|articles?)/i.test(langFree.slice(0, -1).join("/"))) continue;
    const parent = parts.slice(0, -1).join("/");
    byParent.set(parent, [...(byParent.get(parent) ?? []), page]);
  }
  for (const members of byParent.values()) {
    if (members.length < 3) continue;
    const votes = { SERVICE: 0, PRODUCT: 0, PROJECT: 0 };
    for (const page of members) {
      const text = page.cleanContentText || page.parsed.contentText;
      for (const kind of ["PROJECT", "PRODUCT", "SERVICE"] as const) {
        if (COLLECTION_SIGNALS[kind].test(text)) votes[kind]++;
      }
    }
    const [bestKind, bestVotes] = (Object.entries(votes) as [keyof typeof votes, number][]).sort((a, b) => b[1] - a[1])[0]!;
    // At least half the pages must show the signal, and it must beat the others.
    const others = Object.entries(votes).filter(([k]) => k !== bestKind).map(([, v]) => v);
    if (bestVotes < Math.ceil(members.length / 2) || others.some((v) => v >= bestVotes)) continue;
    for (const page of members) page.collectionKind = bestKind;
  }
}

/** Reads /sitemap.xml (and up to 5 child sitemaps). Returns [] when the site has none. */
async function readSitemapUrls(siteUrl: string, fetchPage: PageFetcher): Promise<string[]> {
  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return [];
  }
  const out: string[] = [];
  const read = async (url: string): Promise<{ pages: string[]; childSitemaps: string[] }> => {
    try {
      const res = await fetchPage(url);
      if (res.statusCode < 200 || res.statusCode >= 300 || !/<(?:urlset|sitemapindex)[\s>]/i.test(res.content || "")) {
        return { pages: [], childSitemaps: [] };
      }
      return parseSitemap(res.content);
    } catch {
      return { pages: [], childSitemaps: [] };
    }
  };
  for (const candidate of [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`]) {
    const top = await read(candidate);
    out.push(...top.pages);
    // Page sitemaps first; skip image/video/author/tag sitemaps.
    const children = top.childSitemaps.filter((u) => !/image|video|author|tag|category|attachment/i.test(u)).slice(0, 5);
    for (const child of children) out.push(...(await read(child)).pages);
    if (out.length > 0) break;
  }
  return out.slice(0, 2000);
}

/** Network errors worth trying again: DNS hiccups, resets, timeouts. */
const TRANSIENT_ERROR = /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|socket hang up|timeout|DNS resolution failed/i;
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);

/**
 * Wraps a fetcher so a brief network or DNS failure (or a busy server) is retried
 * instead of failing the whole crawl. Waits `delaysMs[i]` before retry i+1.
 */
export function withRetry(fetchPage: PageFetcher, delaysMs: number[] = [2000, 6000]): PageFetcher {
  return async (url: string) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetchPage(url);
        if (TRANSIENT_STATUS.has(res.statusCode) && attempt < delaysMs.length) {
          await new Promise((r) => setTimeout(r, delaysMs[attempt]));
          continue;
        }
        return res;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (!TRANSIENT_ERROR.test(message) || attempt >= delaysMs.length) throw err;
        await new Promise((r) => setTimeout(r, delaysMs[attempt]));
      }
    }
  };
}

function isHtmlSuccess(res: FetchResult): boolean {
  return res.statusCode >= 200 && res.statusCode < 300 && Boolean(res.content);
}

/**
 * Fetches a supplier website (every page it links to, up to maxPages), drops duplicate and
 * error pages, checks the site still belongs to the supplier, and strips text that repeats
 * on most pages. Does not touch the database, so it can be tested offline.
 */
export async function crawlSite(
  seedUrl: string,
  companyName: string,
  supplierDomain: string | null | undefined,
  fetchPage: PageFetcher,
  maxPages = DEFAULT_MAX_PAGES,
  options: CrawlOptions = {}
): Promise<SiteCrawlResult> {
  const rejected: RejectedPage[] = [];
  const pages: CrawledPage[] = [];
  const seenKeys = new Set<string>();
  const seenFingerprints = new Set<string>();

  let seed: FetchResult;
  try {
    seed = await fetchPage(seedUrl);
  } catch (err: unknown) {
    return {
      pages,
      rejected,
      pagesDiscovered: 1,
      identity: { status: "EMPTY", reason: "Home page could not be fetched" },
      isRetail: false,
      seedError: `Failed to fetch seed URL: ${err instanceof Error ? err.message : "Network error"}`,
    };
  }

  const seedFinalUrl = seed.url || seedUrl;
  const seedParsed = parseAndSanitizeHtml(seed.content || "", seedFinalUrl);

  if (!isHtmlSuccess(seed)) {
    const identity = checkSiteIdentity(companyName, supplierDomain, [
      { url: seedFinalUrl, title: seedParsed.title, fullText: seedParsed.fullText, contentText: seedParsed.contentText, jsonLdScripts: [], mailtoLinks: [] },
    ]);
    const blocked = identity.status === "BLOCKED" || seed.statusCode === 403 || seed.statusCode === 429;
    return {
      pages,
      rejected: [{ url: seedUrl, reason: `HTTP ${seed.statusCode}` }],
      pagesDiscovered: 1,
      identity: blocked
        ? { status: "BLOCKED", reason: `The website blocked the crawler (HTTP ${seed.statusCode})` }
        : { status: "EMPTY", reason: `Home page returned HTTP ${seed.statusCode}` },
      isRetail: false,
      seedError: `Home page returned HTTP ${seed.statusCode}`,
    };
  }

  const addPage = (requestedUrl: string, res: FetchResult, classification: PageClassification, parsed: ExtractedPageContent) => {
    const key = pageKey(res.url || requestedUrl);
    if (seenKeys.has(key)) {
      rejected.push({ url: requestedUrl, reason: "Same page as one already read (redirect or www/non-www copy)" });
      return;
    }
    if (parsed.contentText.length > 0 && seenFingerprints.has(parsed.contentFingerprint)) {
      rejected.push({ url: requestedUrl, reason: "Identical content to a page already read" });
      return;
    }
    seenKeys.add(key);
    seenKeys.add(pageKey(requestedUrl));
    seenFingerprints.add(parsed.contentFingerprint);
    pages.push({ requestedUrl, finalUrl: res.url || requestedUrl, statusCode: res.statusCode, classification, parsed, cleanContentText: parsed.contentText });
  };

  addPage(seedUrl, seed, "HOME", seedParsed);

  // Full-site crawl: follow every same-site link from every page read (menus, footers,
  // dropdowns and body links), plus the pages listed in the site's sitemap, until the
  // whole site is read or the page limit is reached. Contact and service pages go first.
  const queue = new Map<string, DiscoveredLink>();
  const queuedOrDone = new Set<string>([crawlKey(seedUrl), crawlKey(seedFinalUrl)]);
  const enqueue = (link: DiscoveredLink) => {
    const k = crawlKey(link.url);
    if (queuedOrDone.has(k)) return;
    queuedOrDone.add(k);
    queue.set(k, link);
  };
  for (const link of discoverAllSiteLinks(seed.content, seedFinalUrl, seedFinalUrl)) enqueue(link);

  if (options.useSitemap !== false) {
    for (const url of await readSitemapUrls(seedFinalUrl, fetchPage)) {
      if (isCrawlableSameSiteUrl(url, seedFinalUrl)) enqueue({ url, classification: classifyUrl(url) });
    }
  }

  const maxAttempts = Math.ceil(maxPages * 1.5);
  let attempts = 0;
  // Smart page budget: every page in the useful sections, only a sample of news, jobs,
  // product catalogue, project gallery and deep unclassified pages.
  const bucketCounts = new Map<LowValueBucket, number>();
  const overBudget = (link: DiscoveredLink): boolean => {
    const bucket = lowValueBucket(link);
    return bucket !== null && (bucketCounts.get(bucket) ?? 0) >= (options.lowValueBudget ?? LOW_VALUE_PAGE_BUDGET)[bucket];
  };
  const takeNext = (): DiscoveredLink | undefined => {
    let bestKey: string | undefined;
    let best: DiscoveredLink | undefined;
    for (const [k, link] of queue) {
      if (overBudget(link)) {
        queue.delete(k);
        rejected.push({ url: link.url, reason: "Skipped: enough pages of this kind already read (news, jobs, products or projects)" });
        continue;
      }
      if (!best || crawlPriority(link) < crawlPriority(best)) {
        best = link;
        bestKey = k;
      }
    }
    if (bestKey) queue.delete(bestKey);
    const bucket = best ? lowValueBucket(best) : null;
    if (bucket) bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
    return best;
  };

  const worker = async () => {
    for (;;) {
      if (pages.length >= maxPages || attempts >= maxAttempts) return;
      const link = takeNext();
      if (!link) return;
      if (seenKeys.has(pageKey(link.url))) continue;
      attempts++;
      try {
        if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
        const res = await fetchPage(link.url);
        const finalUrl = res.url || link.url;
        if (!isHtmlSuccess(res)) {
          rejected.push({ url: link.url, reason: `HTTP ${res.statusCode}` });
          continue;
        }
        if (!isSameRegistrableDomain(finalUrl, seedFinalUrl)) {
          rejected.push({ url: link.url, reason: `Redirects to another website (${finalUrl})` });
          continue;
        }
        if (res.mimeType && !/html|xhtml/i.test(res.mimeType)) {
          rejected.push({ url: link.url, reason: `Not a web page (${res.mimeType})` });
          continue;
        }
        if (pages.length >= maxPages) return;
        const parsed = parseAndSanitizeHtml(res.content, finalUrl);
        addPage(link.url, res, link.classification, parsed);
        for (const next of discoverAllSiteLinks(res.content, finalUrl, seedFinalUrl)) enqueue(next);
      } catch (err: unknown) {
        rejected.push({ url: link.url, reason: err instanceof Error ? err.message : "Fetch failed" });
      }
    }
  };
  // A few pages at a time: fast, but gentle on small company web servers. Workers that find
  // the queue empty wait briefly in case another worker is about to add links.
  const concurrency = Math.max(1, options.concurrency ?? 3);
  let running = 0;
  await new Promise<void>((resolve) => {
    const launch = () => {
      while (running < concurrency && queue.size > 0 && pages.length < maxPages && attempts < maxAttempts) {
        running++;
        void worker().finally(() => {
          running--;
          if (queue.size > 0 && pages.length < maxPages && attempts < maxAttempts) launch();
          else if (running === 0) resolve();
        });
      }
      if (running === 0) resolve();
    };
    launch();
  });

  const identity = checkSiteIdentity(
    companyName,
    supplierDomain,
    pages.map((p) => ({
      url: p.finalUrl,
      title: p.parsed.title,
      fullText: p.parsed.fullText,
      contentText: p.parsed.contentText,
      jsonLdScripts: p.parsed.jsonLdScripts,
      openGraph: p.parsed.openGraph,
      mailtoLinks: p.parsed.mailtoLinks,
    }))
  );

  const repeated = findRepeatedLines(pages.map((p) => p.parsed.contentText));
  for (const p of pages) {
    p.cleanContentText = removeRepeatedLines(p.parsed.contentText, repeated);
    p.parsed.headings = p.parsed.headings.filter((h) => !repeated.has(h.text.trim().toLowerCase()));
  }

  // Look at the main content only: many site builders hide an empty cart widget in the header.
  const retailPages = pages.filter((p) => RETAIL_SIGNALS.test(p.parsed.contentText)).length;
  // A company that calls itself a distributor on its home or about page mostly sells products.
  const describesItselfAsDistributor = pages
    .filter((p) => p.classification === "HOME" || p.classification === "ABOUT")
    .some((p) => DISTRIBUTOR_SIGNAL.test(p.parsed.contentText) || DISTRIBUTOR_SIGNAL.test(p.parsed.title));
  const isRetail = describesItselfAsDistributor || retailPages >= 2 || (pages.length > 0 && retailPages / pages.length >= 0.4);

  classifyPageCollections(pages);

  return { pages, rejected, pagesDiscovered: queuedOrDone.size, identity, isRetail };
}

export function toExtractorInput(page: CrawledPage, sourceDocumentId: string, supplierCompanyId: string, siteIsRetail = false): ExtractorInput {
  return {
    sourceDocumentId,
    supplierCompanyId,
    sourceUrl: page.finalUrl,
    pageTitle: page.parsed.title,
    visibleText: page.parsed.visibleText,
    contentText: page.cleanContentText,
    fullText: page.parsed.fullText,
    imageAlts: page.parsed.imageAlts,
    headings: page.parsed.headings,
    jsonLdScripts: page.parsed.jsonLdScripts,
    mailtoLinks: page.parsed.mailtoLinks,
    telLinks: page.parsed.telLinks,
    links: page.parsed.links,
    menuGroups: page.parsed.menuGroups,
    collectionKind: page.collectionKind,
    canonicalUrl: page.parsed.canonicalUrl,
    pageType: page.classification,
    siteIsRetail,
  };
}
