import * as cheerio from "cheerio";
import crypto from "crypto";

export interface ExtractedPageContent {
  title: string;
  canonicalUrl: string;
  metaDescription?: string;
  openGraph: Record<string, string>;
  jsonLdScripts: string[];
  /** Headings from the main content (falls back to every heading on the page). */
  headings: { level: string; text: string }[];
  /** Whole page as one line of text, header and footer included (kept for storage). */
  visibleText: string;
  /** Whole page, one block per line, header and footer included. */
  fullText: string;
  /** Main content only, one block per line: menus, headers, footers, forms removed. */
  contentText: string;
  /** Alt text of meaningful images in the main content (certification logos etc.). */
  imageAlts: string[];
  mailtoLinks: string[];
  telLinks: string[];
  /** SHA-256 of the raw HTML. */
  contentHash: string;
  /** SHA-256 of the normalized main content, used to spot the same page at two URLs. */
  contentFingerprint: string;
}

const NON_CONTENT_TAGS = "script, style, noscript, svg, iframe, template, canvas, video, audio, object, embed";

const BLOCK_TAGS =
  "p, div, li, ul, ol, dl, dt, dd, h1, h2, h3, h4, h5, h6, section, article, header, footer, nav, aside, main, table, thead, tbody, tr, td, th, address, blockquote, form, figure, figcaption, label, option, button, pre, hr";

/** Page furniture that repeats on every page and says nothing about the company's work. */
const BOILERPLATE_SELECTORS = [
  // Site headers only: an <article><header> usually holds the page's own title.
  "body > header", "header:has(nav)", "header:has(.menu)", "footer", "nav", "aside", "form", "button", "select",
  "[role=navigation]", "[role=banner]", "[role=contentinfo]", "[role=search]", "[role=dialog]",
  "[aria-hidden=true]", ".screen-reader-text", ".sr-only", ".skip-link",
  "#header", "#footer", "#nav", "#navigation", "#menu", "#sidebar",
  ".site-header", ".site-footer", ".navbar", ".navigation", ".nav-menu", ".main-menu",
  ".menu", ".mega-menu", ".dropdown-menu", ".mobile-menu", ".offcanvas", ".breadcrumb", ".breadcrumbs",
  ".sidebar", ".widget-area", ".social", ".social-links", ".share", ".sharing",
  ".elementor-location-header", ".elementor-location-footer",
  "[class*=cookie]", "[id*=cookie]", "[class*=consent]", ".modal", ".popup",
].join(", ");

const MAIN_SELECTORS = ["main", "[role=main]", "#main-content", "#main", "#content", ".main-content", "article"];

const UNHELPFUL_ALT = /^(?:logo|image|img|photo|picture|banner|icon|slide|background|placeholder|untitled|\d+)$/i;

function blockTextOf($: cheerio.CheerioAPI, root: ReturnType<cheerio.CheerioAPI>): string {
  root.find("br").replaceWith("\n");
  root.find(BLOCK_TAGS).each((_, el) => {
    $(el).before("\n");
    $(el).after("\n");
  });
  const raw = root.text();
  const lines: string[] = [];
  for (const line of raw.split("\n")) {
    const clean = line.replace(/[\s ]+/g, " ").trim();
    if (clean) lines.push(clean);
  }
  return lines.join("\n");
}

export function parseAndSanitizeHtml(html: string, pageUrl: string): ExtractedPageContent {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || "Untitled Page";
  const canonicalUrl = $('link[rel="canonical"]').attr("href") || pageUrl;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim();

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property")?.replace(/^og:/, "");
    const content = $(el).attr("content");
    if (prop && content) openGraph[prop] = content.trim();
  });

  const jsonLdScripts: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const rawJson = $(el).html();
    if (rawJson && rawJson.trim()) jsonLdScripts.push(rawJson.trim());
  });

  const mailtoLinks: string[] = [];
  const telLinks: string[] = [];
  $('a[href^="mailto:"], a[href^="MAILTO:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const email = href.replace(/^mailto:/i, "").split("?")[0]?.trim();
    if (email && !mailtoLinks.includes(email)) mailtoLinks.push(email);
  });
  $('a[href^="tel:"], a[href^="TEL:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const phone = href.replace(/^tel:/i, "").trim();
    if (phone && !telLinks.includes(phone)) telLinks.push(phone);
  });

  // Full page (header and footer kept: addresses and phone numbers usually live there)
  $(NON_CONTENT_TAGS).remove();
  $(".cookie-banner, #cookie-banner, .privacy-policy-banner").remove();
  const visibleText = $("body").text().replace(/\s+/g, " ").trim();

  const $full = cheerio.load($.html());
  const fullText = blockTextOf($full, $full("body"));

  // Main content only
  const $content = cheerio.load($.html());
  const mainCandidate = MAIN_SELECTORS.map((sel) => $content(sel).first()).find((el) => el.length > 0 && el.text().trim().length >= 200);
  const contentRoot = mainCandidate ?? $content("body");
  contentRoot.find(BOILERPLATE_SELECTORS).remove();
  if (!mainCandidate) $content(BOILERPLATE_SELECTORS).remove();

  const headings: { level: string; text: string }[] = [];
  contentRoot.find("h1, h2, h3, h4").each((_, el) => {
    const text = $content(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push({ level: el.tagName.toLowerCase(), text });
  });

  const imageAlts: string[] = [];
  contentRoot.find("img[alt]").each((_, el) => {
    const alt = ($content(el).attr("alt") || "").replace(/\s+/g, " ").trim();
    if (alt.length >= 4 && alt.length <= 150 && !UNHELPFUL_ALT.test(alt) && !imageAlts.includes(alt)) imageAlts.push(alt);
  });

  let contentText = blockTextOf($content, contentRoot);

  // Some sites build the whole page inside header/nav-like wrappers. If stripping left
  // almost nothing, fall back to the page minus only real navigation.
  if (contentText.length < 150) {
    const $fallback = cheerio.load($.html());
    $fallback("nav, [role=navigation], header nav, footer, .menu, .navbar").remove();
    contentText = blockTextOf($fallback, $fallback("body"));
  }

  if (headings.length === 0) {
    $("h1, h2, h3, h4").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text) headings.push({ level: el.tagName.toLowerCase(), text });
    });
  }

  const contentHash = crypto.createHash("sha256").update(html).digest("hex");
  const contentFingerprint = crypto
    .createHash("sha256")
    .update(contentText.toLowerCase().replace(/\s+/g, " ").trim())
    .digest("hex");

  return {
    title,
    canonicalUrl,
    metaDescription,
    openGraph,
    jsonLdScripts,
    headings,
    visibleText,
    fullText,
    contentText,
    imageAlts,
    mailtoLinks,
    telLinks,
    contentHash,
    contentFingerprint,
  };
}
