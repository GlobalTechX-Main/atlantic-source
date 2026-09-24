import { describe, it, expect } from "vitest";
import { parseAndSanitizeHtml } from "@/lib/crawler/parser";
import { classifyUrl } from "@/lib/crawler/discovery";
import { checkSiteIdentity, findRepeatedLines, removeRepeatedLines, pageKey, SitePageSummary } from "@/lib/crawler/siteAnalysis";
import { crawlSite, withRetry } from "@/lib/crawler/pipeline";
import { CertificationExtractor } from "@/lib/extraction/extractors/certification";
import { CapabilityExtractor } from "@/lib/extraction/extractors/capability";
import { ServiceRegionExtractor } from "@/lib/extraction/extractors/serviceRegion";
import { AddressExtractor, cleanAddressSnippet } from "@/lib/extraction/extractors/address";
import { EquipmentExtractor } from "@/lib/extraction/extractors/equipment";
import { containsPhrase, classifyMatchContext } from "@/lib/extraction/text";
import { evaluateDeterministicRules } from "@/lib/validation/rulesEngine";
import { autoPublishEnabled, buildClaimContext } from "@/lib/validation/service";
import { scoreContactCandidate, selectRfqContactsFromClaims } from "@/lib/contacts/selection";
import { ExtractorInput } from "@/lib/extraction/types";
import type { FetchResult } from "@/lib/crawler/fetcher";

/**
 * Regression tests built from mistakes found in a real crawl of 51 Atlantic Canadian
 * supplier websites (24 September 2026). Each sentence below was on a real page.
 */

function input(text: string, overrides: Partial<ExtractorInput> = {}): ExtractorInput {
  return {
    sourceDocumentId: "doc",
    supplierCompanyId: "sup",
    sourceUrl: "https://supplier.example.ca/about",
    pageTitle: "",
    visibleText: text.replace(/\n/g, " "),
    contentText: text,
    fullText: text,
    headings: [],
    jsonLdScripts: [],
    mailtoLinks: [],
    telLinks: [],
    canonicalUrl: "https://supplier.example.ca/about",
    ...overrides,
  };
}

async function certSlugs(text: string): Promise<string[]> {
  const claims = await new CertificationExtractor().extract(input(text));
  return claims.map((c) => c.normalizedValue || "");
}

async function capabilities(text: string, overrides: Partial<ExtractorInput> = {}) {
  return new CapabilityExtractor().extract(input(text, overrides));
}

describe("Whole-word matching", () => {
  it("never matches a phrase inside another word", () => {
    expect(containsPhrase("Incorporated in 1980", "COR")).toBe(false);
    expect(containsPhrase("Quality supervisors check every weld", "ISO")).toBe(false);
    expect(containsPhrase("We weld stainless steel", "Stainless Steel")).toBe(true);
    expect(containsPhrase("Pipe & Pressure Vessel Fabrication", "Pressure Vessel")).toBe(true);
    expect(containsPhrase("Grinding and Machining", "Grinding & Machining")).toBe(true);
  });
});

describe("Certifications", () => {
  it("does not read COR out of ordinary words", async () => {
    for (const sentence of [
      "INCORPORATED IN 1980 Al's Electric Services Ltd has been serving the Greater Moncton Area.",
      "A welcoming workplace is core to our vision.",
      "We advise on corrosion resistance, weight, strength, and cost.",
      "We are a leading manufacturer of corrugated packaging.",
      "Corporate Social Responsibility",
    ]) {
      expect(await certSlugs(sentence)).not.toContain("cor-safety");
    }
  });

  it("finds real COR statements", async () => {
    expect(await certSlugs("NBSCA COR (Health & Safety) Certified")).toContain("cor-safety");
    expect(await certSlugs("The Construction Safety Association awarded us a Certificate of Recognition.")).toContain("cor-safety");
  });

  it("does not read ISO 9001 out of other standards or words", async () => {
    expect(await certSlugs("Our supervisors and CWB inspectors collaborate on quality.")).not.toContain("iso-9001");
    expect(await certSlugs("B&M is now ISO/IEC 27001:2022 certified.")).not.toContain("iso-9001");
    expect(await certSlugs("Health and Safety ISO 45001:2018 certified by Intertek.")).not.toContain("iso-9001");
  });

  it("finds real ISO 9001 and CWB W47.1 statements", async () => {
    expect(await certSlugs("Razor is ISO 9001:2015 registered and is certified CWB W47.1 standard.")).toEqual(
      expect.arrayContaining(["iso-9001", "cwb-w47-1"])
    );
    expect(await certSlugs("A CWB Division 2 Certified Workshop, ISO9001:2015")).toContain("iso-9001");
  });

  it("reads certification logos from image alt text", async () => {
    const claims = await new CertificationExtractor().extract(input("Quality", { imageAlts: ["ISO 9001 system certification logo"] }));
    expect(claims.find((c) => c.normalizedValue === "iso-9001")?.evidenceLocator).toBe("image_alt");
  });
});

describe("Capability context", () => {
  it("classifies how a service word is used", () => {
    const ctx = (unit: string, word: string) => classifyMatchContext(unit, unit.indexOf(word), word.length);
    expect(ctx("Heavy welding and fit-up", "welding")).toBe("DIRECT");
    expect(["RESALE", "PRODUCT_MENTION"]).toContain(ctx("Welding Equipment & Supplies", "Welding"));
    expect(ctx("We are an authorized distributor of welding consumables", "welding")).toBe("RESALE");
    expect(ctx("Support services to industrial manufacturers and machining facilities", "machining")).toBe("AUDIENCE");
    expect(ctx("Helping you tackle complex machine shop challenges", "machine shop")).toBe("AUDIENCE");
    expect(ctx("Whether you are an electrical contractor or purchaser", "electrical contractor")).toBe("AUDIENCE");
    expect(ctx("Marcel - Ext 111 Welding Manager", "Welding")).toBe("JOB_TITLE");
    expect(ctx("Upgraded Welding Ventilation System", "Ventilation")).toBe("PRODUCT_MENTION");
    expect(ctx("Custom Trays for Ventilation", "Ventilation")).toBe("PRODUCT_MENTION");
    expect(ctx("A graduate of the Civil Engineering Technology program", "Civil Engineering")).toBe("EDUCATION");
    expect(ctx("CNC Machining is a process used in the manufacturing sector", "CNC Machining")).toBe("EXPLANATION");
    expect(ctx("How Industrial Automation Helps Manufacturers Stay Competitive", "Industrial Automation")).toBe("EXPLANATION");
    expect(ctx("We supply and install industrial HVAC systems", "industrial HVAC")).not.toBe("RESALE");
  });

  it("keeps direct service statements strong enough to approve", async () => {
    const claims = await capabilities("We specialize in metal fabrication, including carbon steel, stainless steel, and aluminum.");
    const fab = claims.find((c) => c.normalizedValue === "custom-metal-fabrication");
    expect(fab?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("sends weak-context matches to review instead of approving them", async () => {
    const claims = await capabilities("Spot Welding Machine\nOur focus is on total service to the metal fabrication industry.");
    for (const c of claims) {
      expect(c.confidence).toBeLessThan(0.8);
      const verdict = evaluateDeterministicRules({
        supplierCompanyId: "sup",
        supplierName: "Dealer",
        claimType: "CAPABILITY",
        rawValue: c.rawValue,
        extractionMethod: c.extractionMethod,
        extractionConfidence: c.confidence,
        evidenceText: c.evidenceText,
      });
      expect(verdict.decision).toBe("HUMAN_REVIEW");
    }
  });

  it("no longer maps Environmental Engineering to NDT inspection", async () => {
    const claims = await capabilities("Englobe: Environmental Engineering and Consulting Firm");
    expect(claims.some((c) => c.normalizedValue === "ndt-industrial-inspection")).toBe(false);
  });

  it("treats service words on a distributor's site as needing review", async () => {
    const claims = await capabilities("Industrial Coatings", { siteIsRetail: true, sourceUrl: "https://dist.example.ca/services" });
    expect(claims[0]?.confidence).toBeLessThan(0.8);
  });
});

describe("Service regions", () => {
  it("ignores the word Services in menus", async () => {
    const claims = await new ServiceRegionExtractor().extract(input("Home Services Projects Contact Nova Scotia Office"));
    expect(claims).toHaveLength(0);
  });

  it("reads real coverage statements", async () => {
    const claims = await new ServiceRegionExtractor().extract(
      input("From our base in Saint John, we serve Southwestern New Brunswick, from St Stephen to Sussex.")
    );
    expect(claims.map((c) => c.normalizedValue)).toContain("new-brunswick");
  });

  it("does not confuse Saint John's (Newfoundland) with Saint John", async () => {
    const claims = await new ServiceRegionExtractor().extract(input("We serve clients throughout Saint John's and the Avalon."));
    expect(claims.map((c) => c.normalizedValue)).not.toContain("saint-john");
  });
});

describe("Addresses", () => {
  it("starts at the street number, not at a unit number", () => {
    expect(cleanAddressSnippet("Maritime Hose, 55 Akerley Blvd - Unit #10, Dartmouth, Nova Scotia,", "B3B 1M3")).toBe(
      "55 Akerley Blvd - Unit #10, Dartmouth, Nova Scotia B3B 1M3"
    );
  });

  it("drops phone numbers glued in front of an address", () => {
    const address = cleanAddressSnippet("Tel 905 681-5542 Moncton 215 Horsman Road, Unit 3,", "E1E 0J9");
    expect(address?.startsWith("215 Horsman Road")).toBe(true);
  });

  it("adds a city written after the postal code and ignores menu words", async () => {
    const claims = await new AddressExtractor().extract(
      input("Projects\nContact\nMount Pearl\n39, Sagona Avenue, A1N 4P9, Mount Pearl\nTel: 709 555 0101", { sourceUrl: "https://x.ca/contact" })
    );
    expect(claims[0]?.rawValue).toContain("Mount Pearl");
    expect(claims[0]?.evidenceText).not.toContain("PROJECT_OR_CLIENT_LOCATION");
  });

  it("only keeps Atlantic Canadian postal codes from page text", async () => {
    const claims = await new AddressExtractor().extract(input("1910 Hymus Blvd, Dorval, Quebec, H9P 1J7"));
    expect(claims).toHaveLength(0);
  });
});

describe("Equipment", () => {
  it("needs a sign the shop owns the machine", async () => {
    const passing = await new EquipmentExtractor().extract(input("Tools that can be controlled in this manner include lathes, mills and routers."));
    expect(passing.every((c) => c.confidence < 0.8)).toBe(true);
    const owned = await new EquipmentExtractor().extract(input("We have 3 Trumpf press brakes that can bend material to any angle."));
    expect(owned.find((c) => c.normalizedValue === "hydraulic-press-brake")?.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

describe("Page parsing", () => {
  const html = `<html><head><title>Coastal Metals</title></head><body>
    <header><nav><a href="/">Home</a><a href="/services">Services</a><a href="/careers">Careers</a></nav></header>
    <main><h1>Heavy Industrial Fabrication</h1><p>Heavy plate and complex industrial fabrication is our niche.</p>
    <p>We are certified to CSA Standard W47.1 Division 1 and our team completes about two hundred projects every year for clients.</p>
    <img src="cwb.png" alt="CWB certified logo"></main>
    <footer><p>430 Industrial St, Beresford, NB E8K 2C2</p><p>(506) 783-0999</p></footer></body></html>`;

  it("keeps menus and footers out of the main content but in the full text", () => {
    const parsed = parseAndSanitizeHtml(html, "https://coastalmetals.ca/");
    expect(parsed.contentText).toContain("Heavy plate and complex industrial fabrication");
    expect(parsed.contentText).not.toContain("Careers");
    expect(parsed.contentText).not.toContain("Beresford");
    expect(parsed.fullText).toContain("430 Industrial St, Beresford, NB E8K 2C2");
    expect(parsed.fullText.split("\n").length).toBeGreaterThan(3);
    expect(parsed.imageAlts).toContain("CWB certified logo");
  });

  it("classifies pages by whole path words", () => {
    expect(classifyUrl("https://www.guillevin.com/collections/contactors", "Contactors")).not.toBe("CONTACT");
    expect(classifyUrl("https://www.guillevin.com/pages/contact", "Contact")).toBe("CONTACT");
  });

  it("treats www and non-www as the same page", () => {
    expect(pageKey("https://www.atlantichardchrome.com/contact-us/")).toBe(pageKey("https://atlantichardchrome.com/contact-us"));
  });
});

describe("Website identity", () => {
  const page = (title: string, fullText: string, mailtoLinks: string[] = []): SitePageSummary => ({
    url: "https://x.ca/",
    title,
    fullText,
    contentText: fullText,
    jsonLdScripts: [],
    mailtoLinks,
  });

  it("rejects hijacked and parked domains", () => {
    expect(
      checkSiteIdentity("Atlantic Subsea Inc", "atlanticsubsea.ca", [page("VEGAS123: Pusat Situs Slot Gacor Hari Ini Link Slot88", "Situs slot gacor terpercaya")]).status
    ).toBe("PARKED_OR_SPAM");
    expect(checkSiteIdentity("Tractor & Equipment Ltd", "tractorequipment.com", [page("tractorequipment.com for sale | Spaceship.com", "This domain is for sale. Make an offer on this domain.")]).status).toBe(
      "PARKED_OR_SPAM"
    );
  });

  it("flags a domain that now shows another company", () => {
    expect(checkSiteIdentity("Crandall Engineering Ltd", "crandallengineering.ca", [page("Englobe: Environmental Engineering and Consulting Firm", "Englobe offers engineering services.")]).status).toBe(
      "NAME_NOT_FOUND"
    );
  });

  it("accepts the company's own site, including dotted names and own-domain emails", () => {
    expect(checkSiteIdentity("ALPA Equipment Ltd", "alpaequipment.com", [page("S. Mason Timber – A.L.P.A. Equipment", "Testimonials")]).status).toBe("OK");
    expect(checkSiteIdentity("Zeta Works", "zetaworks.ca", [page("Home", "Contact us", ["info@zetaworks.ca"])]).status).toBe("OK");
  });

  it("stops a crawl whose home page is a bot-protection wall", async () => {
    const fetchPage = async (url: string): Promise<FetchResult> => ({
      url,
      statusCode: 403,
      headers: {},
      mimeType: "text/html",
      content: "<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>",
      contentHash: "",
      sizeBytes: 0,
    });
    const result = await crawlSite("https://www.atlanticvalves.com", "Atlantic Valves & Controls", "atlanticvalves.com", fetchPage);
    expect(result.identity.status).toBe("BLOCKED");
    expect(result.pages).toHaveLength(0);
  });

  it("removes lines that repeat on most pages", () => {
    const pages = ["Request a Quote\nWelding services", "Request a Quote\nMachining", "Request a Quote\nContact us", "Request a Quote\nAbout"];
    const repeated = findRepeatedLines(pages);
    expect(repeated.has("request a quote")).toBe(true);
    expect(removeRepeatedLines(pages[0]!, repeated)).toBe("Welding services");
  });
});

describe("Validation rules", () => {
  const base = { supplierCompanyId: "s", supplierName: "Galbraith", supplierDomain: "galbraithconstruction.ca", extractionMethod: "CONTACT_PARSER", extractionConfidence: 0.95 };

  it("does not reject phone numbers because of letters inside words", () => {
    const verdict = evaluateDeterministicRules({
      ...base,
      claimType: "CONTACT",
      rawValue: "5066358855",
      evidenceText: "tel:5066358855",
      surroundingContext: "Three decades of heavy civil work through New Brunswick",
    });
    expect(verdict.decision).toBe("APPROVE");
  });

  it("accepts procurement@ and estimating@ addresses", () => {
    for (const email of ["procurement@galbraithconstruction.ca", "estimating@galbraithconstruction.ca"]) {
      expect(evaluateDeterministicRules({ ...base, claimType: "CONTACT", rawValue: email, evidenceText: `mailto:${email}` }).decision).toBe("APPROVE");
    }
  });

  it("still rejects HR and press addresses", () => {
    expect(evaluateDeterministicRules({ ...base, claimType: "CONTACT", rawValue: "hr@galbraithconstruction.ca", evidenceText: "mailto:hr@galbraithconstruction.ca" }).decision).toBe("REJECT");
  });

  it("judges a fact by the text around it", () => {
    const page = "Home About Careers HR\n...\nFor quotes call 506-635-8855 or email estimating@galbraithconstruction.ca today.";
    expect(buildClaimContext(page, "estimating@galbraithconstruction.ca")).toContain("For quotes call");
  });

  it("does not auto-publish unless the setting is turned on", () => {
    const previous = process.env.AUTO_PUBLISH_LOW_RISK_FACTS;
    delete process.env.AUTO_PUBLISH_LOW_RISK_FACTS;
    expect(autoPublishEnabled()).toBe(false);
    process.env.AUTO_PUBLISH_LOW_RISK_FACTS = "true";
    expect(autoPublishEnabled()).toBe(true);
    if (previous === undefined) delete process.env.AUTO_PUBLISH_LOW_RISK_FACTS;
    else process.env.AUTO_PUBLISH_LOW_RISK_FACTS = previous;
  });
});

describe("RFQ contact choice", () => {
  it("prefers Atlantic numbers over out-of-region numbers", () => {
    expect(scoreContactCandidate("506-783-0999").score).toBeGreaterThan(scoreContactCandidate("416-667-9510").score);
    expect(scoreContactCandidate("1-877-320-1138").score).toBeGreaterThan(scoreContactCandidate("713-595-8880").score);
  });

  it("treats two spellings of one number as one contact", () => {
    const result = selectRfqContactsFromClaims(
      [
        { id: "a", claimType: "CONTACT", rawValue: "+1 506-633-7740", normalizedValue: null },
        { id: "b", claimType: "CONTACT", rawValue: "5066337740", normalizedValue: "5066337740" },
      ],
      "bourqueindustrial.com"
    );
    expect(result.allSelected).toHaveLength(1);
  });
});

describe("Network retries", () => {
  const ok = (url: string): FetchResult => ({ url, statusCode: 200, headers: {}, mimeType: "text/html", content: "<p>ok</p>", contentHash: "", sizeBytes: 9 });

  it("retries a brief DNS failure and then succeeds", async () => {
    let calls = 0;
    const flaky = async (url: string) => {
      calls++;
      if (calls === 1) throw new Error("getaddrinfo ENOTFOUND www.wajax.com");
      return ok(url);
    };
    const res = await withRetry(flaky, [1, 1])("https://www.wajax.com");
    expect(res.statusCode).toBe(200);
    expect(calls).toBe(2);
  });

  it("does not retry errors that will not go away", async () => {
    let calls = 0;
    const blocked = async () => {
      calls++;
      throw new Error("SSRF validation failed: private IP");
    };
    await expect(withRetry(blocked, [1, 1])("https://x.ca")).rejects.toThrow("SSRF");
    expect(calls).toBe(1);
  });

  it("gives up after the last retry", async () => {
    let calls = 0;
    const down = async () => {
      calls++;
      throw new Error("getaddrinfo ENOTFOUND gone.example");
    };
    await expect(withRetry(down, [1, 1])("https://gone.example")).rejects.toThrow("ENOTFOUND");
    expect(calls).toBe(3);
  });
});
