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
    const claims = Array.from({ length: 25 }, (_, i) => ({
      id: `c${i}`,
      claimType: "CONTACT",
      rawValue: `50655501${String(i).padStart(2, "0")}`,
      normalizedValue: `50655501${String(i).padStart(2, "0")}`,
    }));
    const res = selectRfqContactsFromClaims(claims, "acme.ca");
    expect(res.allSelected).toHaveLength(3);
    expect(res.extras).toHaveLength(MAX_CONTACTS - 3);
    expect(res.demotedClaimIds).toHaveLength(25 - MAX_CONTACTS);
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

describe("business hours", () => {
  it("reads opening hours and 24/7 service from page text", async () => {
    const { BusinessHoursExtractor } = await import("@/lib/extraction/extractors/businessHours");
    const claims = await new BusinessHoursExtractor().extract(
      base({ fullText: "Business Hours Monday - Friday: 8:00am to 5:00pm Saturday: closed. We offer 24/7 emergency service." })
    );
    expect(claims.map((c) => c.rawValue)).toEqual(["Monday – Friday: 8:00 AM – 5:00 PM", "Saturday: Closed", "Available 24/7"]);
  });
  it("ignores a bare 24/7 with no service word", async () => {
    const { BusinessHoursExtractor } = await import("@/lib/extraction/extractors/businessHours");
    expect(await new BusinessHoursExtractor().extract(base({ fullText: "Safety is our 24/7 priority" }))).toEqual([]);
  });
});

describe("certifications named without a claim", () => {
  const cert = { supplierCompanyId: "s", supplierName: "Acme", claimType: "CERTIFICATION", rawValue: "ISO 9001", normalizedValue: "iso-9001", extractionMethod: "TAXONOMY_EXACT", extractionConfidence: 0.8 };
  it("drops a passing mention", () => {
    const res = evaluateDeterministicRules({ ...cert, evidenceText: 'Matched certification reference in sentence: "Read our article on ISO 9001 and what it means for buyers"' });
    expect(res.decision).toBe("REJECT");
  });
  it("still sends a real claim to a person", () => {
    const res = evaluateDeterministicRules({ ...cert, evidenceText: 'Matched certification reference in sentence: "Acme is ISO 9001:2015 registered"' });
    expect(res.decision).toBe("HUMAN_REVIEW");
  });
});

describe("one-word service lines filed under /services/", () => {
  it("keeps Marine when the company lists it as a service page", async () => {
    const claims = await new ListedServiceExtractor().extract(
      base({
        sourceUrl: "https://www.easterndesigners.com/",
        links: [
          { href: "https://www.easterndesigners.com/services/buildings/", text: "Buildings" },
          { href: "https://www.easterndesigners.com/services/bridges/", text: "Bridges" },
          { href: "https://www.easterndesigners.com/services/marine/", text: "Marine" },
        ],
      })
    );
    expect(claims.map((c) => c.rawValue)).toEqual(["Buildings", "Bridges", "Marine"]);
  });
  it("still drops a bare industry word used as a services-page heading", () => {
    expect(cleanServiceName("Mining")).toBeNull();
  });
});

describe("Apex-style menus", () => {
  it("reads division capability folders and product lines", async () => {
    const claims = await new ListedServiceExtractor().extract(
      base({
        sourceUrl: "https://www.apexindustries.com/",
        links: [
          { href: "https://www.apexindustries.com/contract-manufacturing/custom-manufacturing-capabilities/cnc-machining/", text: "CNC Machining" },
          { href: "https://www.apexindustries.com/steel-doors/our-products/fire-rated-doors/", text: "Fire Rated Doors" },
          { href: "https://www.apexindustries.com/steel-doors/our-products/security-doors/", text: "Security Doors" },
          { href: "https://www.guillevin.com/products/breaker-qo-15a/", text: "Breaker Qo 15a 1p 120v Plug-in" },
        ],
      })
    );
    expect(claims.filter((c) => c.claimType === "SERVICE_LISTED").map((c) => c.rawValue)).toEqual(["CNC Machining"]);
    expect(claims.filter((c) => c.claimType === "PRODUCT_LISTED").map((c) => c.rawValue)).toEqual(["Fire Rated Doors", "Security Doors"]);
  });

  it("lists standards and memberships from the certifications page, for review", async () => {
    const { ListedCertificationExtractor } = await import("@/lib/extraction/extractors/listedCertification");
    const claims = await new ListedCertificationExtractor().extract(
      base({
        sourceUrl: "https://www.apexindustries.com/steel-doors/affiliations-certifications-steel-doors/",
        contentText: [
          "Our Steel Manufacturing Group has a variety of affiliation, accreditation, and technical certifications.",
          "Door and Hardware Institute (DHI)",
          "Hollow Metal Manufacturers Association (HMMA)",
          "NFPA 80",
          "UL 10C",
          "CAN/ULC S104-10",
          "ANSI / NAAMM / HMMA 861",
          "Request a Quote",
        ].join("\n"),
      })
    );
    expect(claims.map((c) => c.rawValue)).toEqual([
      "Door and Hardware Institute (DHI)",
      "Hollow Metal Manufacturers Association (HMMA)",
      "NFPA 80",
      "UL 10C",
      "CAN/ULC S104-10",
      "ANSI / NAAMM / HMMA 861",
    ]);
    // Shown straight away, labelled "as stated by the company, not verified" (owner decision).
    expect(evaluateDeterministicRules({ supplierCompanyId: "s", supplierName: "Apex", claimType: "CERTIFICATION_LISTED", rawValue: "UL 10C", extractionMethod: "PAGE_STRUCTURE", extractionConfidence: 0.8, evidenceText: "x" }).decision).toBe("APPROVE");
  });

  it("ignores pages that are not about certifications", async () => {
    const { ListedCertificationExtractor } = await import("@/lib/extraction/extractors/listedCertification");
    expect(await new ListedCertificationExtractor().extract(base({ sourceUrl: "https://a.ca/about/", contentText: "NFPA 80" }))).toEqual([]);
  });
});

describe("offerings read from site structure (no folder names needed)", () => {
  it("reads dropdown menu groups and skips housekeeping menus", async () => {
    const { parseAndSanitizeHtml } = await import("@/lib/crawler/parser");
    const html = `<html><body><header><nav><ul>
      <li><a href="/aero/">Aerospace Component Manufacturing</a><ul>
        <li><a href="/aero/capabilities/">Capabilities</a><ul>
          <li><a href="/aero/x/precision-machining/">Precision Machining</a></li>
          <li><a href="/aero/x/sheet-metal/">Sheet Metal</a></li>
          <li><a href="/aero/x/welding/">Welding</a></li></ul></li>
        <li><a href="/aero/work/">Our Work</a><ul>
          <li><a href="/aero/work/embassy/">Embassy</a></li><li><a href="/aero/work/shaw/">Shaw Centre</a></li></ul></li>
      </ul></li>
      <li><a href="/doors/">Steel Door Manufacturing</a><ul>
        <li><a href="/doors/range/">Our Products</a><ul>
          <li><a href="/doors/range/fire-rated/">Fire Rated Doors</a></li>
          <li><a href="/doors/range/security/">Security Doors</a></li></ul></li></ul></li>
      <li><a href="/about/">About Us</a><ul><li><a href="/about/team/">Our Team</a></li><li><a href="/about/history/">History</a></li></ul></li>
      <li><a href="/blog/">Blog</a><ul><li><a href="/2014/04/">April 2014</a></li><li><a href="/2015/03/">March 2015</a></li></ul></li>
    </ul></nav></header><main><p>${"Apex builds parts. ".repeat(20)}</p></main></body></html>`;
    const parsed = parseAndSanitizeHtml(html, "https://apex.example/");
    const claims = await new ListedServiceExtractor().extract(base({ sourceUrl: "https://apex.example/", menuGroups: parsed.menuGroups }));
    expect(claims.filter((c) => c.claimType === "SERVICE_LISTED").map((c) => c.rawValue)).toEqual(["Precision Machining", "Sheet Metal", "Welding"]);
    expect(claims.filter((c) => c.claimType === "PRODUCT_LISTED").map((c) => c.rawValue)).toEqual(["Fire Rated Doors", "Security Doors"]);
  });

  it("classifies sibling pages by what they say, whatever the folder is called", async () => {
    const { classifyPageCollections } = await import("@/lib/crawler/pipeline");
    const mk = (url: string, text: string) =>
      ({ requestedUrl: url, finalUrl: url, statusCode: 200, classification: "OTHER", cleanContentText: text, parsed: { contentText: text } }) as unknown as Parameters<typeof classifyPageCollections>[0][number];
    const pages = [
      mk("https://a.ca/what-we-offer/heavy-lift/", "We provide heavy lift and rigging across Atlantic Canada."),
      mk("https://a.ca/what-we-offer/pile-driving/", "Our crews can drive H pile and sheet pile. We offer turnkey work."),
      mk("https://a.ca/what-we-offer/transport/", "We deliver oversized loads with our specialized trailers."),
      mk("https://a.ca/work/wharf/", "Project value: $4M. Client: Port Saint John. Completed in 2019."),
      mk("https://a.ca/work/bridge/", "Project value: $2M. Client: NB DTI. Completed in 2021."),
      mk("https://a.ca/work/plant/", "Client: Irving Pulp. Completed in 2018. Project details below."),
    ];
    classifyPageCollections(pages);
    expect(pages.slice(0, 3).every((p) => p.collectionKind === "SERVICE")).toBe(true);
    expect(pages.slice(3).every((p) => p.collectionKind === "PROJECT")).toBe(true);
  });
});

describe("services and products shown once", () => {
  it("drops a service that is also a product and merges word-order variants", () => {
    const rows = [
      { claimType: "SERVICE_LISTED", rawValue: "Welding" },
      { claimType: "SERVICE_LISTED", rawValue: "Fire Rated Doors" },
      { claimType: "PRODUCT_LISTED", rawValue: "Fire Rated Doors" },
      { claimType: "PRODUCT_LISTED", rawValue: "Industrial / Commercial Doors" },
      { claimType: "PRODUCT_LISTED", rawValue: "Commercial/Industrial Doors" },
    ];
    const products = summariseListedServices(rows, 40, "PRODUCT_LISTED");
    const services = summariseListedServices(rows, 60, "SERVICE_LISTED", products.names);
    expect(products.names).toEqual(["Fire Rated Doors", "Industrial / Commercial Doors"]);
    expect(services.names).toEqual(["Welding"]);
  });
});
