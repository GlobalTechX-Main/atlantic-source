import { describe, it, expect } from "vitest";
import { crawlSite } from "@/lib/crawler/pipeline";
import { parseSitemap, discoverAllSiteLinks, isCrawlableSameSiteUrl } from "@/lib/crawler/discovery";
import type { FetchResult } from "@/lib/crawler/fetcher";

const page = (title: string, body: string, links: string[]) =>
  `<html><head><title>${title}</title></head><body><nav>${links.map((l) => `<a href="${l}">${l}</a>`).join("")}</nav>` +
  `<main><h1>${title}</h1><p>Acme Fabrication Ltd. ${body} ${"We build steel structures for Atlantic Canada. ".repeat(6)}</p></main></body></html>`;

/** A small site whose deepest pages are only reachable three clicks in, plus one only in the sitemap. */
const SITE: Record<string, string> = {
  "https://acme.ca/": page("Home", "Welcome", ["/services/", "/about/", "/contact/", "/brochure.pdf", "https://other.com/x", "/fr/accueil"]),
  "https://acme.ca/services/": page("Services", "What we do", ["/services/welding/", "/services/machining/"]),
  "https://acme.ca/services/welding/": page("Welding", "Welding", ["/services/welding/aluminum/"]),
  "https://acme.ca/services/welding/aluminum/": page("Aluminum Welding", "Aluminum", ["/"]),
  "https://acme.ca/services/machining/": page("Machining", "CNC", ["/"]),
  "https://acme.ca/about/": page("About", "Since 1970", ["/careers/"]),
  "https://acme.ca/careers/": page("Careers", "Join us", ["/"]),
  "https://acme.ca/contact/": page("Contact", "Call 506-555-0142", ["/"]),
  "https://acme.ca/hidden-page/": page("Crane Rentals", "Only in the sitemap", ["/"]),
  "https://acme.ca/sitemap.xml": `<?xml version="1.0"?><urlset><url><loc>https://acme.ca/hidden-page/</loc></url><url><loc>https://acme.ca/services/</loc></url></urlset>`,
};

const fetchPage = async (url: string): Promise<FetchResult> => {
  const content = SITE[url];
  if (!content) return { url, statusCode: 404, headers: {}, mimeType: "text/html", content: "", contentHash: "", sizeBytes: 0 };
  const mimeType = url.endsWith(".xml") ? "application/xml" : "text/html";
  return { url, statusCode: 200, headers: {}, mimeType, content, contentHash: "", sizeBytes: content.length };
};

describe("full-site crawl", () => {
  it("reads every page, including ones three clicks deep and ones only in the sitemap", async () => {
    const res = await crawlSite("https://acme.ca/", "Acme Fabrication Ltd", "acme.ca", fetchPage);
    const read = res.pages.map((p) => p.finalUrl).sort();
    expect(read).toEqual(
      [
        "https://acme.ca/",
        "https://acme.ca/about/",
        "https://acme.ca/careers/",
        "https://acme.ca/contact/",
        "https://acme.ca/hidden-page/",
        "https://acme.ca/services/",
        "https://acme.ca/services/machining/",
        "https://acme.ca/services/welding/",
        "https://acme.ca/services/welding/aluminum/",
      ].sort()
    );
    // Files, other websites and the French copy are never fetched.
    expect(res.rejected.map((r) => r.url).some((u) => u.includes(".pdf") || u.includes("other.com") || u.includes("/fr/"))).toBe(false);
  });

  it("stops at the page limit, contact and service pages first", async () => {
    const res = await crawlSite("https://acme.ca/", "Acme Fabrication Ltd", "acme.ca", fetchPage, 3, { useSitemap: false });
    expect(res.pages).toHaveLength(3);
    expect(res.pages.map((p) => p.finalUrl)).toContain("https://acme.ca/contact/");
  });

  it("works with several pages at a time", async () => {
    const res = await crawlSite("https://acme.ca/", "Acme Fabrication Ltd", "acme.ca", fetchPage, 150, { concurrency: 4 });
    expect(res.pages).toHaveLength(9);
  });
});

describe("site link helpers", () => {
  it("parses sitemaps and sitemap indexes", () => {
    expect(parseSitemap("<urlset><url><loc>https://a.ca/x</loc></url></urlset>").pages).toEqual(["https://a.ca/x"]);
    expect(parseSitemap("<sitemapindex><sitemap><loc>https://a.ca/page-sitemap.xml</loc></sitemap></sitemapindex>").childSitemaps).toEqual([
      "https://a.ca/page-sitemap.xml",
    ]);
  });

  it("keeps blog, product and career pages but skips files, logins and filters", () => {
    expect(isCrawlableSameSiteUrl("https://a.ca/blog/new-press-brake", "https://a.ca/")).toBe(true);
    expect(isCrawlableSameSiteUrl("https://a.ca/products/hydraulic-cylinders", "https://a.ca/")).toBe(true);
    expect(isCrawlableSameSiteUrl("https://a.ca/careers/welder", "https://a.ca/")).toBe(true);
    expect(isCrawlableSameSiteUrl("https://a.ca/files/brochure.pdf", "https://a.ca/")).toBe(false);
    expect(isCrawlableSameSiteUrl("https://a.ca/my-account/", "https://a.ca/")).toBe(false);
    expect(isCrawlableSameSiteUrl("https://a.ca/shop/?orderby=price", "https://a.ca/")).toBe(false);
  });

  it("finds dropdown menu links", () => {
    const html = `<ul class="dropdown-menu"><li><a href="/steel-doors/capabilities/welding/">Welding</a></li></ul><a href="mailto:x@a.ca">x</a>`;
    expect(discoverAllSiteLinks(html, "https://a.ca/").map((l) => l.url)).toEqual(["https://a.ca/steel-doors/capabilities/welding/"]);
  });
});

describe("smart page budget", () => {
  it("reads every service page but only a sample of news pages", async () => {
    const news = Array.from({ length: 20 }, (_, i) => `/news/post-${i}/`);
    const services = Array.from({ length: 12 }, (_, i) => `/services/service-${i}/`);
    const site: Record<string, string> = {
      "https://big.ca/": page("Home", "Big Co", [...news, ...services]),
    };
    for (const p of [...news, ...services]) site[`https://big.ca${p}`] = page(p, `Unique page ${p}`, ["/"]);
    const fetchBig = async (url: string): Promise<FetchResult> => {
      const content = site[url];
      if (!content) return { url, statusCode: 404, headers: {}, mimeType: "text/html", content: "", contentHash: "", sizeBytes: 0 };
      return { url, statusCode: 200, headers: {}, mimeType: "text/html", content, contentHash: "", sizeBytes: content.length };
    };
    const res = await crawlSite("https://big.ca/", "Big Co", "big.ca", fetchBig, 150, { useSitemap: false });
    const read = res.pages.map((p) => p.finalUrl);
    expect(read.filter((u) => u.includes("/services/"))).toHaveLength(12);
    expect(read.filter((u) => u.includes("/news/"))).toHaveLength(5);
    expect(res.rejected.filter((r) => r.reason.startsWith("Skipped: enough pages"))).toHaveLength(15);
  });
});
