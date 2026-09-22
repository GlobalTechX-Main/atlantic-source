import * as cheerio from "cheerio";
import crypto from "crypto";

export interface ExtractedPageContent {
  title: string;
  canonicalUrl: string;
  metaDescription?: string;
  openGraph: Record<string, string>;
  jsonLdScripts: string[];
  headings: { level: string; text: string }[];
  visibleText: string;
  mailtoLinks: string[];
  telLinks: string[];
  contentHash: string;
}

export function parseAndSanitizeHtml(html: string, pageUrl: string): ExtractedPageContent {
  const $ = cheerio.load(html);

  // Extract Title
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || "Untitled Page";

  // Extract Canonical URL
  const canonicalUrl = $('link[rel="canonical"]').attr("href") || pageUrl;

  // Extract Meta Description
  const metaDescription = $('meta[name="description"]').attr("content")?.trim();

  // Extract OpenGraph tags
  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr("property")?.replace(/^og:/, "");
    const content = $(el).attr("content");
    if (prop && content) {
      openGraph[prop] = content.trim();
    }
  });

  // Extract JSON-LD script content
  const jsonLdScripts: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const rawJson = $(el).html();
    if (rawJson && rawJson.trim()) {
      jsonLdScripts.push(rawJson.trim());
    }
  });

  // Extract Headings
  const headings: { level: string; text: string }[] = [];
  $("h1, h2, h3, h4").each((_, el) => {
    const level = el.tagName.toLowerCase();
    const text = $(el).text().trim();
    if (text) {
      headings.push({ level, text });
    }
  });

  // Extract Mailto & Tel links
  const mailtoLinks: string[] = [];
  const telLinks: string[] = [];

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const email = href.replace(/^mailto:/i, "").split("?")[0]?.trim();
      if (email && !mailtoLinks.includes(email)) mailtoLinks.push(email);
    }
  });

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const phone = href.replace(/^tel:/i, "").trim();
      if (phone && !telLinks.includes(phone)) telLinks.push(phone);
    }
  });

  // Strip non-content tags before extracting visible text
  $("script, style, noscript, svg, iframe").remove();
  $(".cookie-banner, #cookie-banner, .privacy-policy-banner").remove();

  // Extract visible text including header and footer DOM
  const visibleText = $("body").text().replace(/\s+/g, " ").trim();

  // SHA-256 Hash of raw HTML
  const contentHash = crypto.createHash("sha256").update(html).digest("hex");

  return {
    title,
    canonicalUrl,
    metaDescription,
    openGraph,
    jsonLdScripts,
    headings,
    visibleText,
    mailtoLinks,
    telLinks,
    contentHash,
  };
}
