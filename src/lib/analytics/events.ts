export type AnalyticsEventType =
  | "supplier_search"
  | "filter_use"
  | "result_click"
  | "profile_view"
  | "add_to_rfq"
  | "rfq_create"
  | "rfq_send"
  | "email_delivery"
  | "bounce"
  | "supplier_response"
  | "quote_submit"
  | "profile_claim";

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  userId?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

const analyticsStore: AnalyticsEvent[] = [];

export function trackAnalyticsEvent(
  eventType: AnalyticsEventType,
  metadata?: Record<string, unknown> | null,
  userId?: string | null,
  organizationId?: string | null
): AnalyticsEvent {
  const event: AnalyticsEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    eventType,
    userId: userId || null,
    organizationId: organizationId || null,
    metadata: metadata || null,
    createdAt: new Date(),
  };

  analyticsStore.push(event);
  return event;
}

export function getAnalyticsEvents(): AnalyticsEvent[] {
  return [...analyticsStore];
}

export function calculateMarketValidationFunnels() {
  const events = getAnalyticsEvents();

  const searchCount = events.filter((e) => e.eventType === "supplier_search").length;
  const profileCount = events.filter((e) => e.eventType === "profile_view").length;
  const selectedCount = events.filter((e) => e.eventType === "add_to_rfq").length;
  const rfqCreatedCount = events.filter((e) => e.eventType === "rfq_create").length;
  const rfqSentCount = events.filter((e) => e.eventType === "rfq_send").length;

  const deliveredCount = events.filter((e) => e.eventType === "email_delivery").length;
  const respondedCount = events.filter((e) => e.eventType === "supplier_response").length;
  const interestedCount = events.filter(
    (e) => e.eventType === "supplier_response" && e.metadata?.status === "INTERESTED"
  ).length;
  const claimedCount = events.filter((e) => e.eventType === "profile_claim").length;

  return {
    buyerFunnel: {
      searches: searchCount,
      profileViews: profileCount,
      suppliersSelected: selectedCount,
      rfqsCreated: rfqCreatedCount,
      rfqsSent: rfqSentCount,
      conversionRatePct:
        searchCount > 0 ? ((rfqSentCount / searchCount) * 100).toFixed(1) + "%" : "0.0%",
    },
    supplierFunnel: {
      emailsDelivered: deliveredCount,
      responsesReceived: respondedCount,
      interestedResponses: interestedCount,
      profilesClaimed: claimedCount,
      responseRatePct:
        deliveredCount > 0 ? ((respondedCount / deliveredCount) * 100).toFixed(1) + "%" : "0.0%",
    },
  };
}
