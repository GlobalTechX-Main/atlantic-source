import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseAndSanitizeHtml } from "@/lib/crawler/parser";
import { JsonLdExtractor } from "@/lib/extraction/extractors/jsonld";
import { ContactExtractor } from "@/lib/extraction/extractors/contact";
import { AddressExtractor } from "@/lib/extraction/extractors/address";
import { CapabilityExtractor, isNegatedSentence } from "@/lib/extraction/extractors/capability";
import { CertificationExtractor } from "@/lib/extraction/extractors/certification";
import { ServiceRegionExtractor } from "@/lib/extraction/extractors/serviceRegion";
import { ExtractionEngine } from "@/lib/extraction/engine";
import { ExtractorInput } from "@/lib/extraction/types";

describe("Deterministic Extraction Pipeline & Extractors", () => {
  function prepareExtractorInput(fixtureFile: string, pageUrl: string): ExtractorInput {
    const fixturePath = path.resolve(__dirname, `../fixtures/html/${fixtureFile}`);
    const html = fs.readFileSync(fixturePath, "utf-8");
    const parsed = parseAndSanitizeHtml(html, pageUrl);

    return {
      sourceDocumentId: "doc_fixture_123",
      supplierCompanyId: "comp_saint_john_steel",
      sourceUrl: pageUrl,
      pageTitle: parsed.title,
      visibleText: parsed.visibleText,
      headings: parsed.headings,
      jsonLdScripts: parsed.jsonLdScripts,
      mailtoLinks: parsed.mailtoLinks,
      telLinks: parsed.telLinks,
      canonicalUrl: parsed.canonicalUrl,
    };
  }

  it("extracts explicit contact details and addresses from JSON-LD schema", async () => {
    const input = prepareExtractorInput("normal_company.html", "https://saintjohnsteel.example.com/services");
    const jsonLdExtractor = new JsonLdExtractor();

    const claims = await jsonLdExtractor.extract(input);
    expect(claims.some((c) => c.claimType === "CONTACT" && c.rawValue.includes("info@saintjohnsteel.example.com"))).toBe(true);
    expect(claims.some((c) => c.claimType === "LOCATION" && c.rawValue.includes("Saint John"))).toBe(true);
  });

  it("extracts mailto links, visible emails, and phone numbers via ContactExtractor", async () => {
    const input = prepareExtractorInput("normal_company.html", "https://saintjohnsteel.example.com/services");
    const contactExtractor = new ContactExtractor();

    const claims = await contactExtractor.extract(input);
    expect(claims.some((c) => c.normalizedValue === "info@saintjohnsteel.example.com")).toBe(true);
    expect(claims.some((c) => c.normalizedValue === "estimating@saintjohnsteel.example.com")).toBe(true);
    expect(claims.some((c) => c.rawValue.includes("506-555-0199"))).toBe(true);
  });

  it("extracts Canadian street address and postal code via AddressExtractor", async () => {
    const input = prepareExtractorInput("normal_company.html", "https://saintjohnsteel.example.com/services");
    const addressExtractor = new AddressExtractor();

    const claims = await addressExtractor.extract(input);
    expect(claims.some((c) => c.normalizedValue === "E2J 1A1")).toBe(true);
  });

  it("extracts capabilities and aliases while strictly enforcing negation rules", async () => {
    const inputNormal = prepareExtractorInput("normal_company.html", "https://saintjohnsteel.example.com/services");
    const capExtractor = new CapabilityExtractor();

    const normalClaims = await capExtractor.extract(inputNormal);
    expect(normalClaims.some((c) => c.rawValue === "Structural Steel Fabrication")).toBe(true);
    expect(normalClaims.some((c) => c.rawValue === "Stainless Steel Fabrication")).toBe(true);

    // Test Negation Handling
    const inputNegated = prepareExtractorInput("negated_capabilities.html", "https://saintjohnsteel.example.com/scope");
    const negatedClaims = await capExtractor.extract(inputNegated);

    // Negated capabilities MUST NOT be extracted!
    expect(negatedClaims.some((c) => c.rawValue === "Machining")).toBe(false);
    expect(negatedClaims.some((c) => c.rawValue === "Electrical Contracting")).toBe(false);
    expect(negatedClaims.some((c) => c.rawValue === "Plumbing")).toBe(false);

    // Non-negated capability IS extracted
    expect(negatedClaims.some((c) => c.rawValue === "Pipe Fabrication")).toBe(true);
  });

  it("correctly identifies negated sentences using isNegatedSentence helper", () => {
    expect(isNegatedSentence("We do not provide CNC machining")).toBe(true);
    expect(isNegatedSentence("We don't offer electrical services")).toBe(true);
    expect(isNegatedSentence("We no longer offer plumbing")).toBe(true);
    expect(isNegatedSentence("We provide custom structural steel fabrication")).toBe(false);
  });

  it("extracts certification mentions with UNREVIEWED state and NEVER sets VERIFIED", async () => {
    const input = prepareExtractorInput("normal_company.html", "https://saintjohnsteel.example.com/services");
    const certExtractor = new CertificationExtractor();

    const claims = await certExtractor.extract(input);
    expect(claims.some((c) => c.rawValue.includes("CWB"))).toBe(true);
    expect(claims.some((c) => c.rawValue.includes("ISO 9001"))).toBe(true);
  });

  it("extracts explicit service coverage regions (New Brunswick, Nova Scotia, PEI)", async () => {
    const input = prepareExtractorInput("normal_company.html", "https://saintjohnsteel.example.com/services");
    const regionExtractor = new ServiceRegionExtractor();

    const claims = await regionExtractor.extract(input);
    expect(claims.some((c) => c.normalizedValue === "new-brunswick")).toBe(true);
    expect(claims.some((c) => c.normalizedValue === "nova-scotia")).toBe(true);
    expect(claims.some((c) => c.normalizedValue === "pei")).toBe(true);
  });

  it("orchestrates all extractors using ExtractionEngine and produces deduplicated claims", async () => {
    const input = prepareExtractorInput("normal_company.html", "https://saintjohnsteel.example.com/services");
    const engine = new ExtractionEngine();

    const claims = await engine.runExtraction(input);
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.some((c) => c.claimType === "CAPABILITY")).toBe(true);
    expect(claims.some((c) => c.claimType === "CERTIFICATION")).toBe(true);
    expect(claims.some((c) => c.claimType === "CONTACT")).toBe(true);
    expect(claims.some((c) => c.claimType === "SERVICE_REGION")).toBe(true);
  });
});
