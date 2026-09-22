import { describe, it, expect } from "vitest";
import { calculateContactConfidence } from "@/lib/contacts/confidence";
import { ContactExtractor } from "@/lib/extraction/extractors/contact";
import { parseAndSanitizeHtml } from "@/lib/crawler/parser";

describe("Deterministic Contact Confidence Engine", () => {
  it("returns LOW confidence when no contacts exist", () => {
    const res = calculateContactConfidence([]);
    expect(res.rating).toBe("LOW");
    expect(res.label).toBe("Unverified Public Contact");
  });

  it("calculates HIGH confidence for verified contact with matching website domain", () => {
    const res = calculateContactConfidence(
      [
        {
          publicBusinessEmail: "john@saintjohnsteel.example.com",
          publicBusinessPhone: "506-555-0199",
          provenanceType: "VERIFIED",
          verificationState: "VERIFIED",
        },
      ],
      "https://saintjohnsteel.example.com",
      "saintjohnsteel.example.com"
    );

    expect(res.rating).toBe("HIGH");
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.reasons).toContain("Email domain matches company website domain");
  });

  it("calculates MEDIUM confidence for unverified public business phone/email", () => {
    const res = calculateContactConfidence(
      [
        {
          publicBusinessEmail: "sales@monctonmachining.ca",
          publicBusinessPhone: "506-555-0899",
          provenanceType: "PUBLICLY_DISCOVERED",
          verificationState: "UNREVIEWED",
        },
      ],
      "https://moncton-group-holdings.com"
    );

    expect(res.rating).toBe("MEDIUM");
    expect(res.score).toBeGreaterThanOrEqual(45);
  });

  it("penalizes generic email domains (e.g. gmail.com) and email bounces", () => {
    const resBounced = calculateContactConfidence([
      {
        publicBusinessEmail: "owner@gmail.com",
        bouncedAt: new Date(),
      },
    ]);

    expect(resBounced.rating).toBe("LOW");
    expect(resBounced.reasons).toContain("Recent email bounce recorded");
  });
});

describe("ContactExtractor Regression Fixtures & Rules", () => {

  it("extracts phone only present in <a href='tel:+15065550199'>", async () => {
    const html = `<html><body><a href="tel:+15065550199">Call Our Shop</a></body></html>`;
    const parsed = parseAndSanitizeHtml(html, "https://example.com");
    const extractor = new ContactExtractor();

    const claims = await extractor.extract({
      sourceDocumentId: "doc_1",
      supplierCompanyId: "comp_1",
      sourceUrl: "https://example.com",
      pageTitle: "Test",
      visibleText: parsed.visibleText,
      headings: parsed.headings,
      jsonLdScripts: parsed.jsonLdScripts,
      mailtoLinks: parsed.mailtoLinks,
      telLinks: parsed.telLinks,
      canonicalUrl: "https://example.com",
    });

    expect(claims.some((c) => c.evidenceLocator === "TEL_HREF" && c.normalizedValue === "5065550199")).toBe(true);
  });

  it("extracts email only present in mailto: link", async () => {
    const html = `<html><body><a href="mailto:info@atlanticmetal.ca?subject=RFQ">Get in touch</a></body></html>`;
    const parsed = parseAndSanitizeHtml(html, "https://example.com");
    const extractor = new ContactExtractor();

    const claims = await extractor.extract({
      sourceDocumentId: "doc_1",
      supplierCompanyId: "comp_1",
      sourceUrl: "https://example.com",
      pageTitle: "Test",
      visibleText: parsed.visibleText,
      headings: parsed.headings,
      jsonLdScripts: parsed.jsonLdScripts,
      mailtoLinks: parsed.mailtoLinks,
      telLinks: parsed.telLinks,
      canonicalUrl: "https://example.com",
    });

    expect(claims.some((c) => c.evidenceLocator === "MAILTO_HREF" && c.normalizedValue === "info@atlanticmetal.ca")).toBe(true);
  });

  it("extracts phone link wrapping SVG icon", async () => {
    const html = `<html><body><a href="tel:+15065550199"><svg><path d="M0 0h24v24H0z"/></svg><span>Call Us</span></a></body></html>`;
    const parsed = parseAndSanitizeHtml(html, "https://example.com");
    const extractor = new ContactExtractor();

    const claims = await extractor.extract({
      sourceDocumentId: "doc_1",
      supplierCompanyId: "comp_1",
      sourceUrl: "https://example.com",
      pageTitle: "Test",
      visibleText: parsed.visibleText,
      headings: parsed.headings,
      jsonLdScripts: parsed.jsonLdScripts,
      mailtoLinks: parsed.mailtoLinks,
      telLinks: parsed.telLinks,
      canonicalUrl: "https://example.com",
    });

    expect(claims.some((c) => c.normalizedValue === "5065550199")).toBe(true);
  });

  it("extracts telephone and email from JSON-LD schema", async () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": "Imperial Group",
          "telephone": "1-800-561-3100",
          "email": "orders@imperialgroup.ca"
        }
      </script>
    </head><body>Welcome</body></html>`;

    const parsed = parseAndSanitizeHtml(html, "https://example.com");
    const extractor = new ContactExtractor();

    const claims = await extractor.extract({
      sourceDocumentId: "doc_1",
      supplierCompanyId: "comp_1",
      sourceUrl: "https://example.com",
      pageTitle: "Test",
      visibleText: parsed.visibleText,
      headings: parsed.headings,
      jsonLdScripts: parsed.jsonLdScripts,
      mailtoLinks: parsed.mailtoLinks,
      telLinks: parsed.telLinks,
      canonicalUrl: "https://example.com",
    });

    expect(claims.some((c) => c.evidenceLocator === "JSON_LD" && c.normalizedValue === "8005613100")).toBe(true);
    expect(claims.some((c) => c.evidenceLocator === "JSON_LD" && c.normalizedValue === "orders@imperialgroup.ca")).toBe(true);
  });

  it("deduplicates duplicate phone numbers present in href and visible text", async () => {
    const html = `<html><body><a href="tel:+15065550199">Call 506-555-0199</a><p>Direct: 506-555-0199</p></body></html>`;
    const parsed = parseAndSanitizeHtml(html, "https://example.com");
    const extractor = new ContactExtractor();

    const claims = await extractor.extract({
      sourceDocumentId: "doc_1",
      supplierCompanyId: "comp_1",
      sourceUrl: "https://example.com",
      pageTitle: "Test",
      visibleText: parsed.visibleText,
      headings: parsed.headings,
      jsonLdScripts: parsed.jsonLdScripts,
      mailtoLinks: parsed.mailtoLinks,
      telLinks: parsed.telLinks,
      canonicalUrl: "https://example.com",
    });

    const phoneClaims = claims.filter((c) => c.normalizedValue === "5065550199");
    expect(phoneClaims.length).toBe(1);
  });

  it("distinguishes and excludes fax lines from primary business phone", async () => {
    const html = `<html><body><p>Office Fax: 506-857-0342</p><p>Phone: 506-857-1909</p></body></html>`;
    const parsed = parseAndSanitizeHtml(html, "https://example.com");
    const extractor = new ContactExtractor();

    const claims = await extractor.extract({
      sourceDocumentId: "doc_1",
      supplierCompanyId: "comp_1",
      sourceUrl: "https://example.com",
      pageTitle: "Test",
      visibleText: parsed.visibleText,
      headings: parsed.headings,
      jsonLdScripts: parsed.jsonLdScripts,
      mailtoLinks: parsed.mailtoLinks,
      telLinks: parsed.telLinks,
      canonicalUrl: "https://example.com",
    });

    expect(claims.some((c) => c.normalizedValue === "5068570342")).toBe(false);
    expect(claims.some((c) => c.normalizedValue === "5068571909")).toBe(true);
  });

  it("handles malformed tel and mailto URIs safely", async () => {
    const html = `<html><body><a href="tel:abc12">Invalid</a><a href="mailto:not-an-email">Invalid Mail</a></body></html>`;
    const parsed = parseAndSanitizeHtml(html, "https://example.com");
    const extractor = new ContactExtractor();

    const claims = await extractor.extract({
      sourceDocumentId: "doc_1",
      supplierCompanyId: "comp_1",
      sourceUrl: "https://example.com",
      pageTitle: "Test",
      visibleText: parsed.visibleText,
      headings: parsed.headings,
      jsonLdScripts: parsed.jsonLdScripts,
      mailtoLinks: parsed.mailtoLinks,
      telLinks: parsed.telLinks,
      canonicalUrl: "https://example.com",
    });

    expect(claims.length).toBe(0);
  });

  it("excludes third-party phone numbers referenced in partner section", async () => {
    const html = `<html><body><p>Work completed with our partner at 506-555-9999</p></body></html>`;
    const parsed = parseAndSanitizeHtml(html, "https://example.com");
    const extractor = new ContactExtractor();

    const claims = await extractor.extract({
      sourceDocumentId: "doc_1",
      supplierCompanyId: "comp_1",
      sourceUrl: "https://example.com",
      pageTitle: "Test",
      visibleText: parsed.visibleText,
      headings: parsed.headings,
      jsonLdScripts: parsed.jsonLdScripts,
      mailtoLinks: parsed.mailtoLinks,
      telLinks: parsed.telLinks,
      canonicalUrl: "https://example.com",
    });

    expect(claims.some((c) => c.normalizedValue === "5065559999")).toBe(false);
  });
});
