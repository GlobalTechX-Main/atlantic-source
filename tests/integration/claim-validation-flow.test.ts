import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { validateAndProcessSupplierClaims } from "@/lib/validation/service";
import { VerificationStatusEnum, ClaimStatusEnum, ExtractionMethodEnum, VerificationStateEnum } from "@prisma/client";

describe("Automated Claim Validation Service & Auto-Publishing Integration Test", () => {
  let supplierId: string;
  let docId: string;

  beforeAll(async () => {
    // Seed test supplier
    const supplier = await db.supplierCompany.create({
      data: {
        canonicalName: "Validation Flow Test Corp",
        slug: "validation-flow-test-corp",
        normalizedDomain: "validationtest.ca",
        websiteUrl: "https://validationtest.ca",
        verificationStatus: VerificationStatusEnum.UNVERIFIED,
        claimStatus: ClaimStatusEnum.UNCLAIMED,
      },
    });
    supplierId = supplier.id;

    // Seed dummy CrawlRun & SourceDocument
    const crawlRun = await db.crawlRun.create({
      data: {
        supplierCompanyId: supplierId,
        seedUrl: "https://validationtest.ca",
        status: "COMPLETED",
      },
    });

    const doc = await db.sourceDocument.create({
      data: {
        supplierCompanyId: supplierId,
        crawlRunId: crawlRun.id,
        sourceUrl: "https://validationtest.ca/services",
        canonicalUrl: "https://validationtest.ca/services",
        pageType: "SERVICES",
        title: "Our Industrial Capabilities",
        httpStatus: 200,
        mimeType: "text/html",
        contentHash: "val_doc_hash_123",
        extractedText: "Validation Flow Test Corp provides industrial CNC machining, structural welding, and custom steel fabrication in Fredericton NB.",
      },
    });
    docId = doc.id;

    // Seed low-risk claims (Contact phone, Contact email, Exact Capability)
    await db.extractedClaim.createMany({
      data: [
        {
          supplierCompanyId: supplierId,
          sourceDocumentId: docId,
          claimType: "CONTACT",
          rawValue: "506-555-0188",
          evidenceText: "Call us at 506-555-0188 for estimates.",
          extractionMethod: ExtractionMethodEnum.CONTACT_PARSER,
          confidence: 0.95,
          reviewState: VerificationStateEnum.UNREVIEWED,
        },
        {
          supplierCompanyId: supplierId,
          sourceDocumentId: docId,
          claimType: "CONTACT",
          rawValue: "sales@validationtest.ca",
          evidenceText: "Email sales@validationtest.ca for sales.",
          extractionMethod: ExtractionMethodEnum.CONTACT_PARSER,
          confidence: 0.95,
          reviewState: VerificationStateEnum.UNREVIEWED,
        },
        {
          supplierCompanyId: supplierId,
          sourceDocumentId: docId,
          claimType: "CAPABILITY",
          rawValue: "Machining",
          normalizedValue: "machining",
          evidenceText: "We specialize in precision CNC machining for industrial clients.",
          extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
          confidence: 0.95,
          reviewState: VerificationStateEnum.UNREVIEWED,
        },
        {
          supplierCompanyId: supplierId,
          sourceDocumentId: docId,
          claimType: "CAPABILITY",
          rawValue: "Underwater Nuclear Welding",
          evidenceText: "We do NOT provide underwater nuclear welding.",
          extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
          confidence: 0.9,
          reviewState: VerificationStateEnum.UNREVIEWED,
        },
      ],
    });
  });

  afterAll(async () => {
    if (supplierId) {
      await db.supplierCompany.delete({ where: { id: supplierId } }).catch(() => {});
    }
  });

  it("validates batch claims, auto-approves low-risk facts, auto-rejects negated claims, and triggers auto-publishing", async () => {
    const stats = await validateAndProcessSupplierClaims(supplierId);

    expect(stats.totalProcessed).toBe(4);
    expect(stats.autoApproved).toBeGreaterThanOrEqual(3);
    expect(stats.autoRejected).toBeGreaterThanOrEqual(1);

    // Verify DB states of processed claims
    const claims = await db.extractedClaim.findMany({ where: { supplierCompanyId: supplierId } });
    const phoneClaim = claims.find((c) => c.rawValue === "506-555-0188");
    expect(phoneClaim?.reviewState).toBe("AUTO_APPROVED");
    expect(phoneClaim?.validationRisk).toBe("LOW");

    const negatedClaim = claims.find((c) => c.rawValue.includes("Nuclear"));
    expect(negatedClaim?.reviewState).toBe("AUTO_REJECTED");
    expect(negatedClaim?.validationReason).toContain("negation");
  });
});
