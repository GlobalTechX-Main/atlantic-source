import Link from "next/link";
import { Building2, Wrench, Inbox, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function SupplierPortalPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Supplier Portal Overview</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your verified company profile, submit capability & certification updates, and view incoming buyer sourcing requests.
        </p>
      </div>

      {/* Provenance Notice */}
      <div className="bg-atlantic-50 border border-atlantic-200 rounded-xl p-4 text-xs text-atlantic-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-atlantic-600 flex-shrink-0" />
          <span>
            <strong>Supplier Provided Provenance Rule:</strong> Profile edits and certification submissions are stored as <code>SUPPLIER_PROVIDED</code> in <code>UNREVIEWED</code> state until platform admin verification. Crawler evidence is preserved.
          </span>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link
          href="/portal/profile"
          className="group bg-white border border-slate-200 hover:border-atlantic-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-atlantic-50 text-atlantic-600 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-atlantic-600 group-hover:translate-x-1 transition" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Manage Profile & Capabilities</h3>
          <p className="text-xs text-slate-500">
            Update company description, add capabilities, locations, and submit certifications.
          </p>
        </Link>

        <Link
          href="/portal/opportunities"
          className="group bg-white border border-slate-200 hover:border-atlantic-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
          </div>
          <h3 className="text-base font-bold text-slate-900">RFQ Sourcing Opportunities</h3>
          <p className="text-xs text-slate-500">
            View incoming buyer sourcing requests, respond with interest, or submit indicative quotes.
          </p>
        </Link>
      </div>

      {/* Profile Verification Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-atlantic-600" />
            Company Identity & Claim Verification
          </h3>
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            VERIFIED SUPPLIER ADMIN
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Your company profile is claimed and active. You have Supplier Admin authority to edit profile details and manage team access. Note: Only GTEX platform administrators can approve claims to full AtlanticSource Verified status.
        </p>
      </div>
    </div>
  );
}
