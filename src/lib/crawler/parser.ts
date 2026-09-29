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
  /** Every web link on the page (menus and footer included), absolute URL plus its text. */
  links: { href: string; text: string }[];
  /**
   * Dropdown / mega-menu groups: a list of links plus the labels above it, outermost first
   * (["Steel Door Manufacturing", "Our Products"] → Fire Rated Doors, Security Doors, …).
   */
  menuGroups: MenuGroup[];
  /** SHA-256 of the raw HTML. */
  contentHash: string;
  /** SHA-256 of the normalized main content, used to spot the same page at two URLs. */
  contentFingerprint: string;
}

export interface MenuGroup {
  trail: string[];
  links: { href: string; text: string }[];
}

const MENU_SCOPE = "nav, header, [role=navigation], [class*=menu], [class*=nav], [id*=menu], [id*=nav], [class*=dropdown], [class*=mega]";

function directLabel(el: cheerio.Cheerio<import("domhandler").Element>): string {
  // The item's own text: its first link/label child, not the nested list under it.
  const own = el.children("a, span, button, strong, h2, h3, h4, h5, h6, p, div").first();
  const text = (own.length ? own.clone().children("ul, ol, div").remove().end().text() : "").replace(/\s+/g, " ").trim();
  return text.slice(0, 80);
}

/** Reads menus as groups of links with the labels they sit under. */
function readMenuGroups($: cheerio.CheerioAPI, pageUrl: string): MenuGroup[] {
  const groups: MenuGroup[] = [];
  const seen = new Set<string>();
  $(MENU_SCOPE)
    .find("ul, ol")
    .each((_, listEl) => {
      if (groups.length >= 80) return;
      const list = $(listEl);
      const links: { href: string; text: string }[] = [];
      list.children("li").each((__, li) => {
        const a = $(li).children("a[href]").first().length ? $(li).children("a[href]").first() : $(li).find("a[href]").first();
        const rawHref = (a.attr("href") || "").trim();
        const text = a.clone().children("ul, ol").remove().end().text().replace(/\s+/g, " ").trim();
        if (!rawHref || !text || rawHref.startsWith("#") || /^(mailto|tel|javascript):/i.test(rawHref)) return;
        try {
          links.push({ href: new URL(rawHref, pageUrl).toString(), text: text.slice(0, 80) });
        } catch {
          // skip bad link
        }
      });
      if (links.length < 2) return;

      // Labels above this list: a column heading right before it, then each enclosing menu item.
      const trail: string[] = [];
      const heading = list.prevAll("a, span, strong, h2, h3, h4, h5, h6, p, div").first();
      const headingText = heading.length ? heading.clone().children("ul, ol").remove().end().text().replace(/\s+/g, " ").trim() : "";
      if (headingText && headingText.length <= 80) trail.unshift(headingText);
      list.parents("li").each((__, li) => {
        const label = directLabel($(li));
        if (label && trail[0] !== label) trail.unshift(label);
      });
      const key = links.map((l) => l.href).join("|");
      if (seen.has(key)) return;
      seen.add(key);
      groups.push({ trail, links });
    });
  return groups;
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

  // All web links, before anything is removed: service menus and social icons live in headers/footers.
  const links: { href: string; text: string }[] = [];
  const seenLinks = new Set<string>();
  $("a[href]").each((_, el) => {
    if (links.length >= 400) return;
    const rawHref = ($(el).attr("href") || "").trim();
    if (!rawHref || rawHref.startsWith("#") || /^(mailto|tel|javascript):/i.test(rawHref)) return;
    let href: string;
    try {
      href = new URL(rawHref, pageUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:/i.test(href)) return;
    const text = ($(el).text() || $(el).attr("aria-label") || $(el).attr("title") || "").replace(/\s+/g, " ").trim();
    const k = `${href}|${text}`;
    if (seenLinks.has(k)) return;
    seenLinks.add(k);
    links.push({ href, text });
  });

  const menuGroups = readMenuGroups($, pageUrl);

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
    links,
    menuGroups,
    contentHash,
    contentFingerprint,
  };
}
