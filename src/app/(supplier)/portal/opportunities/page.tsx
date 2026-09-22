import { getSupplierOpportunities } from "@/lib/supplier/opportunities";
import { UserSession } from "@/lib/auth/session";
import { UserRoleEnum } from "@prisma/client";
import { Inbox, CheckCircle2, Clock, XCircle } from "lucide-react";

export default async function SupplierOpportunitiesPage() {
  const mockUserSession: { user: UserSession } = {
    user: {
      id: "usr_supp_admin_1",
      email: "john@saintjohnsteel.example.com",
      isPlatformAdmin: false,
      supplierMemberships: [{ supplierCompanyId: "comp_saint_john_steel", role: UserRoleEnum.SUPPLIER_ADMIN }],
      buyerMemberships: [],
    },
  };

  const opportunitiesData = await getSupplierOpportunities(
    mockUserSession.user,
    "comp_saint_john_steel"
  );

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">RFQ Sourcing Opportunities</h1>
        <p className="text-xs text-slate-500 mt-1">
          Sourcing requests dispatched to your company by Atlantic Canadian buyers.
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
          <span className="text-2xl font-extrabold text-atlantic-600 block">
            {opportunitiesData.counts.new}
          </span>
          <span className="text-xs font-semibold text-slate-500 uppercase">New Requests</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
          <span className="text-2xl font-extrabold text-emerald-600 block">
            {opportunitiesData.counts.responded}
          </span>
          <span className="text-xs font-semibold text-slate-500 uppercase">Responded</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
          <span className="text-2xl font-extrabold text-slate-700 block">
            {opportunitiesData.counts.declined}
          </span>
          <span className="text-xs font-semibold text-slate-500 uppercase">Declined</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-center">
          <span className="text-2xl font-extrabold text-blue-600 block">
            {opportunitiesData.counts.quoteSubmitted}
          </span>
          <span className="text-xs font-semibold text-slate-500 uppercase">Quotes Submitted</span>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-4 h-4 text-atlantic-600" />
            Received Sourcing Requests ({opportunitiesData.counts.total})
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {opportunitiesData.opportunities.map((opp) => (
            <div key={opp.id} className="p-6 hover:bg-slate-50 transition space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{opp.title}</h4>
                  <p className="text-xs text-slate-500">Buyer: <strong className="text-slate-700">{opp.buyerOrgName}</strong> ({opp.city || "NB"})</p>
                </div>
                <div>
                  {opp.responseStatus === "PENDING" && (
                    <span className="px-2.5 py-1 text-xs font-bold rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      NEW / AWAITING RESPONSE
                    </span>
                  )}
                  {opp.responseStatus === "INTERESTED" && (
                    <span className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      INTERESTED
                    </span>
                  )}
                  {opp.responseStatus === "DECLINED" && (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      DECLINED
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 text-xs pt-1">
                <a
                  href={`/rfq/response?id=${opp.sourcingRequestId}`}
                  className="px-3.5 py-1.5 bg-atlantic-600 text-white font-bold rounded-lg hover:bg-atlantic-700 transition"
                >
                  Open RFQ & Respond
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
