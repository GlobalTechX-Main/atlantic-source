import type { FetchResult } from "@/lib/crawler/fetcher";
import { parseAndSanitizeHtml, ExtractedPageContent } from "@/lib/crawler/parser";
import { discoverHighValueLinks, PageClassification } from "@/lib/crawler/discovery";
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

export const DEFAULT_MAX_SUBPAGES = 12;

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
 * Fetches a supplier website (home page + the most useful subpages), drops duplicate and
 * error pages, checks the site still belongs to the supplier, and strips text that repeats
 * on most pages. Does not touch the database, so it can be tested offline.
 */
export async function crawlSite(
  seedUrl: string,
  companyName: string,
  supplierDomain: string | null | undefined,
  fetchPage: PageFetcher,
  maxSubpages = DEFAULT_MAX_SUBPAGES
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

  const links = discoverHighValueLinks(seed.content, seedFinalUrl, maxSubpages);
  for (const link of links) {
    if (seenKeys.has(pageKey(link.url))) continue;
    try {
      const res = await fetchPage(link.url);
      if (!isHtmlSuccess(res)) {
        rejected.push({ url: link.url, reason: `HTTP ${res.statusCode}` });
        continue;
      }
      addPage(link.url, res, link.classification, parseAndSanitizeHtml(res.content, res.url || link.url));
    } catch (err: unknown) {
      rejected.push({ url: link.url, reason: err instanceof Error ? err.message : "Fetch failed" });
    }
  }

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

  return { pages, rejected, pagesDiscovered: 1 + links.length, identity, isRetail };
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
    canonicalUrl: page.parsed.canonicalUrl,
    pageType: page.classification,
    siteIsRetail,
  };
}
