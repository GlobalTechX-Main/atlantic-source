import Link from "next/link";
import { Building2, Wrench, Users, Inbox, ShieldCheck } from "lucide-react";

export default function SupplierPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between hidden md:flex">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Building2 className="w-5 h-5 text-atlantic-400" />
            <span>Supplier Portal</span>
          </div>

          <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-[11px] text-slate-400 border border-slate-700 flex items-center gap-1.5 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Claimed Supplier Admin</span>
          </div>

          <nav className="space-y-1 text-xs">
            <Link
              href="/portal"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium"
            >
              <Building2 className="w-4 h-4 text-slate-400" />
              Portal Overview
            </Link>

            <Link
              href="/portal/profile"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium"
            >
              <Wrench className="w-4 h-4 text-slate-400" />
              Manage Profile & Certs
            </Link>

            <Link
              href="/portal/opportunities"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium"
            >
              <Inbox className="w-4 h-4 text-slate-400" />
              RFQ Opportunities
            </Link>

            <Link
              href="/portal/members"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium"
            >
              <Users className="w-4 h-4 text-slate-400" />
              Team & Permissions
            </Link>
          </nav>
        </div>

        <div className="p-6 border-t border-slate-800 text-[11px] text-slate-500">
          <span>AtlanticSource B2B Supplier Intelligence Platform</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-w-5xl">
        {children}
      </main>
    </div>
  );
}
