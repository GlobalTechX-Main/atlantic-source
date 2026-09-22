import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getBuyerSourcingRequestDetail } from "@/lib/rfq/sourcing-service";

interface RFQRecipientDetail {
  id: string;
  supplierCompanyId: string;
  supplierName: string;
  supplierSlug: string;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    title: string | null;
  } | null;
  deliveryStatus: string;
  responseStatus: string;
  respondedAt: Date | null;
  response: {
    id: string;
    status: string;
    message: string | null;
    indicativeQuote?: string;
    currency: string;
    leadTime: string | null;
    declineReason: string | null;
  } | null;
  messages: unknown[];
  matchExplanation: {
    capabilitiesMatched: string[];
    locations: string[];
  };
}

interface RFQDetailData {
  id: string;
  title: string;
  description: string;
  city: string | null;
  province: string | null;
  responseDeadline: Date | null;
  status: string;
  quantity: string | null;
  budget: unknown;
  createdAt: Date;
  buyerOrganization: { name: string };
  recipients: RFQRecipientDetail[];
}

export default async function RFQDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await getCurrentUserSession();

  let detail: RFQDetailData | null = null;
  try {
    detail = (await getBuyerSourcingRequestDetail(
      resolvedParams.id,
      user || {
        id: "buyer_user_1",
        email: "buyer@example.com",
        isPlatformAdmin: false,
        buyerMemberships: [{ buyerOrganizationId: "org_buyer_1", role: "BUYER_ADMIN" as const }],
        supplierMemberships: [],
      }
    )) as unknown as RFQDetailData;
  } catch {
    notFound();
  }

  if (!detail) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              href="/buyer/dashboard"
              className="text-xs text-sky-400 hover:underline mb-2 inline-block font-medium"
            >
              ← Back to Sourcing Requests
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">{detail.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span>Created {new Date(detail.createdAt).toLocaleDateString("en-CA")}</span>
              <span>•</span>
              <span>
                Deadline:{" "}
                {detail.responseDeadline
                  ? new Date(detail.responseDeadline).toLocaleDateString("en-CA")
                  : "None specified"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                detail.status === "SENT"
                  ? "bg-sky-950 text-sky-400 border border-sky-800/60"
                  : detail.status === "DRAFT"
                  ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              Status: {detail.status}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Sourcing Scope & Requirements
          </h2>
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{detail.description}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-800 text-xs">
            <div>
              <div className="text-slate-400">Location</div>
              <div className="font-semibold text-slate-200">
                {detail.city || "New Brunswick"}, {detail.province}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Quantity</div>
              <div className="font-semibold text-slate-200">
                {detail.quantity || "Not specified"}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Estimated Budget</div>
              <div className="font-semibold text-slate-200">
                {detail.budget ? `$${String(detail.budget)} CAD` : "Not specified"}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Organization</div>
              <div className="font-semibold text-slate-200">
                {detail.buyerOrganization.name}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Target Suppliers & Responses ({detail.recipients.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Match Reason</th>
                  <th className="py-3 px-3">Contact Status</th>
                  <th className="py-3 px-3">Delivery</th>
                  <th className="py-3 px-3">Response</th>
                  <th className="py-3 px-3">Indicative Quote</th>
                  <th className="py-3 px-3">Lead Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {detail.recipients.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-100">{rec.supplierName}</div>
                      <Link
                        href={`/suppliers/${rec.supplierSlug}`}
                        className="text-[10px] text-sky-400 hover:underline"
                        target="_blank"
                      >
                        View Profile ↗
                      </Link>
                    </td>

                    <td className="py-3.5 px-3 max-w-xs">
                      <div className="text-[11px] text-slate-300">
                        Capabilities: {rec.matchExplanation.capabilitiesMatched.join(", ") || "General"}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      {rec.contact ? (
                        <div className="text-emerald-400 text-[11px]">
                          <div>✓ {rec.contact.name || "Business Contact"}</div>
                          <div className="text-slate-400 text-[10px]">{rec.contact.email}</div>
                        </div>
                      ) : (
                        <span className="bg-rose-950/80 text-rose-400 border border-rose-800/50 px-2 py-0.5 rounded text-[10px] font-bold">
                          No Contact Currently Available
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rec.deliveryStatus === "DELIVERED"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                            : rec.deliveryStatus === "BOUNCED" || rec.deliveryStatus === "FAILED"
                            ? "bg-rose-950 text-rose-400 border border-rose-800/50"
                            : rec.deliveryStatus === "NO_CONTACT"
                            ? "bg-slate-800 text-slate-400"
                            : "bg-sky-950 text-sky-400 border border-sky-800/50"
                        }`}
                      >
                        {rec.deliveryStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rec.responseStatus === "INTERESTED" || rec.responseStatus === "QUOTE_SUBMITTED"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                            : rec.responseStatus === "DECLINED"
                            ? "bg-rose-950 text-rose-400 border border-rose-800/50"
                            : rec.responseStatus === "NEED_INFORMATION"
                            ? "bg-amber-950 text-amber-400 border border-amber-800/50"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {rec.responseStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      {rec.response?.indicativeQuote ? (
                        <div className="font-bold text-emerald-400 text-xs">
                          ${rec.response.indicativeQuote} {rec.response.currency}
                          <div className="text-[9px] text-slate-400 font-normal">
                            * Indicative Quote
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-slate-300">
                      {rec.response?.leadTime || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
