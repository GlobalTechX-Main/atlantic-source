import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { UserSession } from "@/lib/auth/session";
import { createSourcingRequest, sendSourcingRequest, getBuyerSourcingRequests, getBuyerSourcingRequestDetail } from "@/lib/rfq/sourcing-service";
import { processOneClickResponse, submitIndicativeQuote } from "@/lib/rfq/supplier-response-service";
import { generateRFQResponseToken } from "@/lib/rfq/token";
import { ProfileStatusEnum } from "@prisma/client";

describe("End-to-End Buyer-to-Supplier RFQ Workflow Integration Test", () => {
  let testBuyerOrgId: string;
  let testBuyerUser: UserSession;
  let testSupplierId: string;
  let testContactId: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // Setup buyer organization & user
    const org = await db.buyerOrganization.create({
      data: {
        id: `e2e_buyer_org_${timestamp}`,
        name: "E2E Atlantic Procurement Inc",
        website: "https://atlanticprocurement.ca",
        normalizedDomain: `atlanticprocurement-${timestamp}.ca`,
      },
    });
    testBuyerOrgId = org.id;

    const userEmail = `buyer_${timestamp}@atlanticprocurement.ca`;
    const userDb = await db.user.create({
      data: {
        id: `e2e_buyer_user_${timestamp}`,
        email: userEmail,
        normalizedEmail: userEmail,
        name: "E2E Buyer User",
      },
    });

    testBuyerUser = {
      id: userDb.id,
      email: userDb.email,
      isPlatformAdmin: false,
      buyerMemberships: [{ buyerOrganizationId: testBuyerOrgId, role: "BUYER_ADMIN" }],
      supplierMemberships: [],
    };

    // Setup published supplier company & contact
    const supp = await db.supplierCompany.create({
      data: {
        id: `e2e_supp_${timestamp}`,
        canonicalName: "E2E Atlantic Industrial Fabrication Ltd",
        slug: `e2e-atlantic-industrial-fab-${timestamp}`,
        normalizedDomain: `e2efab-${timestamp}.ca`,
        profileStatus: ProfileStatusEnum.PUBLISHED,
        contacts: {
          create: {
            id: `e2e_contact_${timestamp}`,
            name: "Dave Product Manager",
            publicBusinessEmail: `sales@e2efab-${timestamp}.ca`,
            contactType: "SALES",
            provenanceType: "VERIFIED",
            verificationState: "VERIFIED",
          },
        },
      },
      include: { contacts: true },
    });

    testSupplierId = supp.id;
    testContactId = supp.contacts[0]!.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await db.rFQResponse.deleteMany({
      where: { recipient: { sourcingRequest: { buyerOrganizationId: testBuyerOrgId } } },
    });
    await db.rFQRecipient.deleteMany({
      where: { sourcingRequest: { buyerOrganizationId: testBuyerOrgId } },
    });
    await db.sourcingRequest.deleteMany({
      where: { buyerOrganizationId: testBuyerOrgId },
    });
    await db.contact.deleteMany({
      where: { id: testContactId },
    });
    await db.supplierCompany.deleteMany({
      where: { id: testSupplierId },
    });
    await db.buyerOrganization.deleteMany({
      where: { id: testBuyerOrgId },
    });
    await db.user.deleteMany({
      where: { id: testBuyerUser?.id },
    });
  });

  it("completes full workflow: RFQ Creation -> Outreach -> Signed Response -> Quote Submission -> Buyer Dashboard", async () => {
    // 1. Create Sourcing Request
    const createdRfq = await createSourcingRequest(testBuyerUser, {
      buyerOrganizationId: testBuyerOrgId,
      title: "E2E Structural Steel & Pipe Supply",
      description: "Require 40 metric tons of structural steel beams and piping.",
      city: "Saint John",
      province: "NB",
      quantity: "40 metric tons",
      budget: 150000.0,
      supplierCompanyIds: [testSupplierId],
    });

    expect(createdRfq.id).toBeDefined();
    expect(createdRfq.status).toBe("DRAFT");

    // Verify PostgreSQL persistence of SourcingRequest & RFQRecipient
    const dbRfq = await db.sourcingRequest.findUnique({
      where: { id: createdRfq.id },
      include: { recipients: true },
    });

    expect(dbRfq).not.toBeNull();
    expect(dbRfq?.title).toBe("E2E Structural Steel & Pipe Supply");
    expect(dbRfq?.recipients.length).toBe(1);
    expect(dbRfq?.recipients[0]!.supplierCompanyId).toBe(testSupplierId);

    const recipientId = dbRfq!.recipients[0]!.id;

    // 2. Send Sourcing Request (Email Outreach)
    const sentRfq = await sendSourcingRequest(createdRfq.id, testBuyerUser);
    expect(sentRfq.status).toBe("SENT");

    // 3. Generate Signed Supplier Token & Simulate One-Click Response (INTERESTED)
    const interestedToken = generateRFQResponseToken({
      recipientId,
      sourcingRequestId: createdRfq.id,
      supplierCompanyId: testSupplierId,
      action: "INTERESTED",
    });

    const responseResult = await processOneClickResponse({
      tokenString: interestedToken,
      message: "We have capacity and material available.",
    });

    expect(responseResult.success).toBe(true);
    expect(responseResult.sourcingRequest.title).toBe("E2E Structural Steel & Pipe Supply");
    expect(responseResult.supplierCompany.name).toBe("E2E Atlantic Industrial Fabrication Ltd");

    // Verify DB RFQRecipient responseStatus updated to INTERESTED
    const dbRecipientAfterInterested = await db.rFQRecipient.findUnique({
      where: { id: recipientId },
      include: { response: true },
    });
    expect(dbRecipientAfterInterested?.responseStatus).toBe("INTERESTED");

    // 4. Submit Indicative Quote
    const quoteResult = await submitIndicativeQuote({
      tokenString: interestedToken,
      indicativeQuote: 142500.0,
      currency: "CAD",
      leadTime: "3 weeks",
      message: "Includes FOB Saint John delivery.",
    });

    expect(quoteResult.success).toBe(true);
    expect(quoteResult.response.indicativeQuote).toBe("142500");

    // Verify DB RFQResponse row
    const dbResponse = await db.rFQResponse.findUnique({
      where: { recipientId },
    });
    expect(dbResponse).not.toBeNull();
    expect(dbResponse?.status).toBe("QUOTE_SUBMITTED");
    expect(dbResponse?.indicativeQuote?.toString()).toBe("142500");
    expect(dbResponse?.leadTime).toBe("3 weeks");

    // 5. Query Buyer Dashboard & Detail Views from PostgreSQL
    const dashboardRequests = await getBuyerSourcingRequests(testBuyerOrgId, testBuyerUser);
    expect(dashboardRequests.length).toBeGreaterThanOrEqual(1);
    const targetDashboardReq = dashboardRequests.find((r) => r.id === createdRfq.id);
    expect(targetDashboardReq).toBeDefined();
    expect(targetDashboardReq?.status).toBe("SENT");
    expect(targetDashboardReq?.recipientCount).toBe(1);
    expect(targetDashboardReq?.responseCount).toBe(1);
    expect(targetDashboardReq?.quoteCount).toBe(1);

    const detailView = await getBuyerSourcingRequestDetail(createdRfq.id, testBuyerUser);
    expect(detailView.id).toBe(createdRfq.id);
    expect(detailView.recipients.length).toBe(1);
    expect(detailView.recipients[0]!.supplierName).toBe("E2E Atlantic Industrial Fabrication Ltd");
    expect(detailView.recipients[0]!.responseStatus).toBe("QUOTE_SUBMITTED");
    expect(detailView.recipients[0]!.response?.indicativeQuote).toBe("142500");
  });
});
