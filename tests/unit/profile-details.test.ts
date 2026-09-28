import { describe, it, expect } from "vitest";
import { ListedServiceExtractor, cleanServiceName } from "@/lib/extraction/extractors/listedService";
import { SocialLinkExtractor, parseSocialLink } from "@/lib/extraction/extractors/social";
import { summariseListedServices, pickSocialLinks, isPublicContactType, contactOrder } from "@/lib/supplier/profileExtras";
import { selectRfqContactsFromClaims, MAX_CONTACTS } from "@/lib/contacts/selection";
import { evaluateDeterministicRules } from "@/lib/validation/rulesEngine";
import { parseAndSanitizeHtml } from "@/lib/crawler/parser";
import type { ExtractorInput } from "@/lib/extraction/types";

const base = (over: Partial<ExtractorInput>): ExtractorInput => ({
  sourceDocumentId: "d",
  supplierCompanyId: "s",
  sourceUrl: "https://www.irvingequipment.com/",
  pageTitle: "Home",
  visibleText: "",
  headings: [],
  jsonLdScripts: [],
  mailtoLinks: [],
  telLinks: [],
  canonicalUrl: "https://www.irvingequipment.com/",
  ...over,
});

describe("cleanServiceName", () => {
  it("keeps service names and tidies ALL CAPS", () => {
    expect(cleanServiceName("HEAVY LIFT & RIGGING")).toBe("Heavy Lift & Rigging");
    expect(cleanServiceName("Pile Driving")).toBe("Pile Driving");
  });
  it("drops slogans, calls to action, places and section titles", () => {
    for (const t of ["Our Services", "Have a question? We are here to help.", "Learn More", "New Brunswick (Head Office)", "Why Choose Us", "Your project is our pride", "Mining", "here", "Français", "%%title%%"]) {
      expect(cleanServiceName(t)).toBeNull();
    }
  });
});

describe("ListedServiceExtractor", () => {
  it("reads service names from links to the company's own service pages", async () => {
    const claims = await new ListedServiceExtractor().extract(
      base({
        links: [
          { href: "https://www.irvingequipment.com/en/services/heavy-lift-rigging/", text: "HEAVY LIFT & RIGGING" },
          { href: "https://www.irvingequipment.com/en/services/pile-driving/", text: "Pile Driving" },
          { href: "https://www.irvingequipment.com/en/services/", text: "Services" },
          { href: "https://www.irvingequipment.com/en/services/pile-driving/projects/wharf-4/", text: "Wharf 4 Rebuild" },
          { href: "https://other-company.com/services/welding/", text: "Welding" },
        ],
      })
    );
    expect(claims.map((c) => c.rawValue)).toEqual(["Heavy Lift & Rigging", "Pile Driving"]);
    expect(claims.every((c) => c.claimType === "SERVICE_LISTED" && c.confidence >= 0.85)).toBe(true);
  });

  it("reads section headings on the services page and sends slogans to review", async () => {
    const claims = await new ListedServiceExtractor().extract(
      base({
        sourceUrl: "https://www.atlantictowing.com/en/our-services/",
        pageType: "SERVICES",
        headings: [
          { level: "h1", text: "OUR SERVICES" },
          { level: "h2", text: "Towing & Barge Transportation" },
          { level: "h2", text: "Recognized know-how" },
        ],
      })
    );
    const byName = new Map(claims.map((c) => [c.rawValue, c.confidence]));
    expect(byName.get("Towing & Barge Transportation")).toBeGreaterThanOrEqual(0.85);
    expect(byName.get("Recognized Know-How") ?? byName.get("Recognized know-how")).toBeLessThan(0.85);
  });
});

describe("social links", () => {
  it("recognises company pages and ignores share buttons and posts", () => {
    expect(parseSocialLink("https://ca.linkedin.com/company/irving-equipment/")?.url).toBe("https://www.linkedin.com/company/irving-equipment");
    expect(parseSocialLink("https://www.facebook.com/sharer/sharer.php?u=x")).toBeNull();
    expect(parseSocialLink("https://twitter.com/intent/tweet?text=x")).toBeNull();
    expect(parseSocialLink("https://www.instagram.com/p/C123/")).toBeNull();
    expect(parseSocialLink("https://www.linkedin.com/in/some-person")).toBeNull();
    expect(parseSocialLink("https://www.youtube.com/@CoastalMetalsLTD")?.platform).toBe("YOUTUBE");
  });

  it("extracts social claims from page links", async () => {
    const claims = await new SocialLinkExtractor().extract(
      base({ links: [{ href: "https://www.facebook.com/alpaequipment/", text: "Facebook" }, { href: "https://example.com/", text: "x" }] })
    );
    expect(claims).toHaveLength(1);
    expect(claims[0]?.rawValue).toBe("https://www.facebook.com/alpaequipment");
  });

  it("keeps one link per platform, the one linked from the most pages", () => {
    const rows = [
      { claimType: "SOCIAL", rawValue: "https://www.linkedin.com/company/laurentide-controls" },
      { claimType: "SOCIAL", rawValue: "https://www.linkedin.com/company/atlantic-controls" },
      { claimType: "SOCIAL", rawValue: "https://www.linkedin.com/company/atlantic-controls" },
      { claimType: "SOCIAL", rawValue: "https://www.facebook.com/atlanticcontrols" },
    ];
    expect(pickSocialLinks(rows).map((l) => l.url)).toEqual([
      "https://www.linkedin.com/company/atlantic-controls",
      "https://www.facebook.com/atlanticcontrols",
    ]);
  });
});

describe("parser links", () => {
  it("collects menu and footer links with absolute URLs", () => {
    const html = `<html><body><nav><a href="/services/welding/">Welding</a></nav><main><p>${"x ".repeat(120)}</p></main><footer><a href="https://www.facebook.com/acme">Facebook</a><a href="#top">Top</a></footer></body></html>`;
    const parsed = parseAndSanitizeHtml(html, "https://acme.ca/");
    expect(parsed.links).toEqual([
      { href: "https://acme.ca/services/welding/", text: "Welding" },
      { href: "https://www.facebook.com/acme", text: "Facebook" },
    ]);
  });
});

describe("profile summaries", () => {
  it("merges spelling variants of the same service", () => {
    const res = summariseListedServices([
      { claimType: "SERVICE_LISTED", rawValue: "Heavy Lift & Rigging", sourceUrl: "https://a.ca/services/" },
      { claimType: "SERVICE_LISTED", rawValue: "Heavy Lift and Rigging", sourceUrl: "https://a.ca/" },
      { claimType: "SERVICE_LISTED", rawValue: "Pile Driving" },
    ]);
    expect(res.names).toEqual(["Heavy Lift & Rigging", "Pile Driving"]);
    expect(res.sources).toEqual(["https://a.ca/services/"]);
  });

  it("shows department emails but not named people", () => {
    expect(isPublicContactType("SALES")).toBe(true);
    expect(isPublicContactType("GENERAL")).toBe(true);
    expect(isPublicContactType("INDIVIDUAL_BUSINESS_CONTACT")).toBe(false);
  });

  it("orders contacts primary, backups, then others", () => {
    const names = ["Other Contact 02", "Backup RFQ Contact 2", "Primary RFQ Contact", "Other Contact 01", "Backup RFQ Contact 1"];
    expect([...names].sort((a, b) => contactOrder(a) - contactOrder(b))).toEqual([
      "Primary RFQ Contact",
      "Backup RFQ Contact 1",
      "Backup RFQ Contact 2",
      "Other Contact 01",
      "Other Contact 02",
    ]);
  });
});

describe("contact selection keeps more than three", () => {
  it("keeps other usable contacts as extras up to the limit", () => {
    const claims = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`,
      claimType: "CONTACT",
      rawValue: `50655501${String(i).padStart(2, "0")}`,
      normalizedValue: `50655501${String(i).padStart(2, "0")}`,
    }));
    const res = selectRfqContactsFromClaims(claims, "acme.ca");
    expect(res.allSelected).toHaveLength(3);
    expect(res.extras).toHaveLength(MAX_CONTACTS - 3);
    expect(res.demotedClaimIds).toHaveLength(15 - MAX_CONTACTS);
  });
});

describe("rules for the new fact types", () => {
  const input = { supplierCompanyId: "s", supplierName: "Irving Equipment", rawValue: "Pile Driving", extractionMethod: "PAGE_STRUCTURE", evidenceText: "Link" };
  it("approves clear service names and social links, reviews unclear headings", () => {
    expect(evaluateDeterministicRules({ ...input, claimType: "SERVICE_LISTED", extractionConfidence: 0.9 }).decision).toBe("APPROVE");
    expect(evaluateDeterministicRules({ ...input, claimType: "SERVICE_LISTED", extractionConfidence: 0.6 }).decision).toBe("HUMAN_REVIEW");
    expect(evaluateDeterministicRules({ ...input, claimType: "SOCIAL", extractionConfidence: 0.9 }).decision).toBe("APPROVE");
  });
});
