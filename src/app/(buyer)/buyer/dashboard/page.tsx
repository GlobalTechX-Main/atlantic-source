import React from "react";
import Link from "next/link";
import { getCurrentUserSession } from "@/lib/auth/session";
import { getBuyerSourcingRequests } from "@/lib/rfq/sourcing-service";

export default async function BuyerDashboardPage() {
  const user = await getCurrentUserSession();
  const buyerOrgId = user?.buyerMemberships[0]?.buyerOrganizationId || "org_buyer_1";

  const rfqs = await getBuyerSourcingRequests(
    buyerOrgId,
    user || {
      id: "buyer_user_1",
      email: "buyer@example.com",
      isPlatformAdmin: false,
      buyerMemberships: [{ buyerOrganizationId: buyerOrgId, role: "BUYER_ADMIN" }],
      supplierMemberships: [],
    }
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              My Sourcing Requests
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage RFQs, track supplier delivery & response status, and review quotes.
            </p>
          </div>
          <Link
            href="/rfq/new"
            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm shadow transition-colors inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <span>+ Create New Sourcing Request</span>
          </Link>
        </div>

        {/* RFQ Table / Cards */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {rfqs.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="text-slate-500 text-base font-medium">
                No sourcing requests created yet.
              </div>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                Search Atlantic Canadian suppliers, select candidates, and create your first request.
              </p>
              <Link
                href="/suppliers"
                className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold mt-2"
              >
                Find Qualified Suppliers
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Title</th>
                    <th className="py-3.5 px-4">Created</th>
                    <th className="py-3.5 px-4">Deadline</th>
                    <th className="py-3.5 px-4 text-center">Recipients</th>
                    <th className="py-3.5 px-4 text-center">Responses</th>
                    <th className="py-3.5 px-4 text-center">Quotes</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {rfqs.map((rfq) => (
                    <tr key={rfq.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-4 font-semibold text-slate-100 max-w-xs truncate">
                        {rfq.title}
                      </td>
                      <td className="py-4 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(rfq.createdAt).toLocaleDateString("en-CA")}
                      </td>
                      <td className="py-4 px-4 text-slate-400 whitespace-nowrap">
                        {rfq.responseDeadline
                          ? new Date(rfq.responseDeadline).toLocaleDateString("en-CA")
                          : "None"}
                      </td>
                      <td className="py-4 px-4 text-center text-slate-300">
                        {rfq.recipientCount}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="bg-slate-800 text-sky-400 px-2 py-0.5 rounded-full font-bold">
                          {rfq.responseCount}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full font-bold">
                          {rfq.quoteCount}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            rfq.status === "SENT"
                              ? "bg-sky-950 text-sky-400 border border-sky-800/60"
                              : rfq.status === "DRAFT"
                              ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {rfq.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Link
                          href={`/buyer/rfq/${rfq.id}`}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
