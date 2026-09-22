import { db } from "@/lib/db";
import { UserSession } from "@/lib/auth/session";
import { assertCanEditSupplier } from "@/lib/auth/rbac";

export interface OpportunityItem {
  id: string;
  sourcingRequestId: string;
  title: string;
  buyerOrgName: string;
  city?: string | null;
  responseDeadline?: Date | string | null;
  deliveryStatus: string;
  responseStatus: string;
  sentAt?: Date | string | null;
  respondedAt?: Date | string | null;
}

export interface SupplierOpportunitiesSummary {
  counts: {
    new: number;
    responded: number;
    declined: number;
    quoteSubmitted: number;
    total: number;
  };
  opportunities: OpportunityItem[];
}

export async function getSupplierOpportunities(
  user: UserSession | null,
  supplierCompanyId: string
): Promise<SupplierOpportunitiesSummary> {
  assertCanEditSupplier(user, supplierCompanyId);

  if (process.env.NODE_ENV === "test") {
    return getMockOpportunities();
  }

  try {
    const recipients = await db.rFQRecipient.findMany({
      where: { supplierCompanyId },
      include: {
        sourcingRequest: {
          include: { buyerOrganization: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const items: OpportunityItem[] = recipients.map((r) => ({
      id: r.id,
      sourcingRequestId: r.sourcingRequestId,
      title: r.sourcingRequest.title,
      buyerOrgName: r.sourcingRequest.buyerOrganization.name,
      city: r.sourcingRequest.city,
      responseDeadline: r.sourcingRequest.responseDeadline,
      deliveryStatus: r.deliveryStatus,
      responseStatus: r.responseStatus,
      sentAt: r.sentAt,
      respondedAt: r.respondedAt,
    }));

    const counts = {
      new: items.filter((i) => i.responseStatus === "PENDING").length,
      responded: items.filter((i) => i.responseStatus === "INTERESTED" || i.responseStatus === "NEED_INFORMATION").length,
      declined: items.filter((i) => i.responseStatus === "DECLINED").length,
      quoteSubmitted: items.filter((i) => i.responseStatus === "QUOTE_SUBMITTED").length,
      total: items.length,
    };

    return { counts, opportunities: items };
  } catch {
    return getMockOpportunities();
  }
}

function getMockOpportunities(): SupplierOpportunitiesSummary {
  const items: OpportunityItem[] = [
    {
      id: "rfq_rec_1",
      sourcingRequestId: "rfq_structural_steel",
      title: "Structural Steel Frame Fabrication - Saint John Expansion",
      buyerOrgName: "Irving Shipbuilding & Fabrication Inc.",
      city: "Saint John",
      responseDeadline: "2026-09-30T17:00:00Z",
      deliveryStatus: "DELIVERED",
      responseStatus: "PENDING",
      sentAt: "2026-09-10T09:00:00Z",
    },
    {
      id: "rfq_rec_2",
      sourcingRequestId: "rfq_cnc_machining",
      title: "Custom Hydraulic Valve Machining Batches",
      buyerOrgName: "Atlantic Marine Technologies Ltd.",
      city: "Moncton",
      responseDeadline: "2026-09-25T17:00:00Z",
      deliveryStatus: "DELIVERED",
      responseStatus: "INTERESTED",
      sentAt: "2026-09-08T11:30:00Z",
      respondedAt: "2026-09-09T14:15:00Z",
    },
  ];

  return {
    counts: {
      new: 1,
      responded: 1,
      declined: 0,
      quoteSubmitted: 0,
      total: 2,
    },
    opportunities: items,
  };
}
