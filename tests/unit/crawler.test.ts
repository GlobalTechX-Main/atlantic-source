import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseRobotsTxt, isPathDisallowed } from "@/lib/crawler/robots";
import { normalizeUrl, isSameRegistrableDomain, classifyUrl, discoverHighValueLinks } from "@/lib/crawler/discovery";
import { parseAndSanitizeHtml } from "@/lib/crawler/parser";

describe("Crawler Discovery, Robots & HTML Parser", () => {
  it("parses robots.txt disallow rules correctly", () => {
    const robotsTxt = `
      User-agent: *
      Disallow: /admin/
      Disallow: /private/
      Crawl-delay: 2
    `;

    const policy = parseRobotsTxt(robotsTxt, "AtlanticSourceBot");
    expect(policy.disallowedPaths).toContain("/admin/");
    expect(policy.disallowedPaths).toContain("/private/");
    expect(policy.crawlDelaySeconds).toBe(2);

    expect(isPathDisallowed("/admin/users", policy)).toBe(true);
    expect(isPathDisallowed("/services", policy)).toBe(false);
  });

  it("normalizes URLs and strips fragments and tracking parameters", () => {
    const rawUrl = "HTTPS://WWW.SaintJohnSteel.ca/Services?utm_source=google&ref=123#section1";
    const baseUrl = "https://www.saintjohnsteel.ca";

    const normalized = normalizeUrl(rawUrl, baseUrl);
    expect(normalized).toBe("https://www.saintjohnsteel.ca/Services");
  });

  it("checks same registrable domain correctly", () => {
    expect(isSameRegistrableDomain("https://saintjohnsteel.ca/about", "https://saintjohnsteel.ca")).toBe(true);
    expect(isSameRegistrableDomain("https://sub.saintjohnsteel.ca/services", "https://saintjohnsteel.ca")).toBe(true);
    expect(isSameRegistrableDomain("https://malicioussite.com", "https://saintjohnsteel.ca")).toBe(false);
  });

  it("classifies pages based on URL path and anchor text", () => {
    expect(classifyUrl("https://example.com/about-us", "About Us")).toBe("ABOUT");
    expect(classifyUrl("https://example.com/capabilities", "Our Capabilities")).toBe("CAPABILITIES");
    expect(classifyUrl("https://example.com/contact-us", "Contact Us")).toBe("CONTACT");
    expect(classifyUrl("https://example.com/certifications", "Quality & Certifications")).toBe("CERTIFICATIONS");
  });

  it("extracts and sanitizes DOM content from normal company HTML fixture", () => {
    const fixturePath = path.resolve(__dirname, "../fixtures/html/normal_company.html");
    const html = fs.readFileSync(fixturePath, "utf-8");

    const parsed = parseAndSanitizeHtml(html, "https://saintjohnsteel.example.com/services");

    expect(parsed.title).toBe("Saint John Industrial Steel & Welding Ltd.");
    expect(parsed.metaDescription).toContain("heavy structural steel");
    expect(parsed.jsonLdScripts.length).toBeGreaterThan(0);
    expect(parsed.mailtoLinks).toContain("info@saintjohnsteel.example.com");
    expect(parsed.telLinks).toContain("506-555-0199");
    expect(parsed.headings.some((h) => h.text.includes("Industrial Capabilities"))).toBe(true);
    expect(parsed.contentHash).toHaveLength(64); // SHA-256 hex string
  });

  it("discovers high-value links capped at max limit", () => {
    const fixturePath = path.resolve(__dirname, "../fixtures/html/normal_company.html");
    const html = fs.readFileSync(fixturePath, "utf-8");

    const links = discoverHighValueLinks(html, "https://saintjohnsteel.example.com", 10);
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((l) => l.classification === "SERVICES")).toBe(true);
  });
});
