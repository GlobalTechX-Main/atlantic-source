import React from "react";
import Link from "next/link";
import {
  Building2,
  Upload,
  Globe,
  CheckSquare,
  Tags,
  ShieldAlert,
  History,
  Activity,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { getCurrentUserSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUserSession();

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <Link href="/admin/suppliers" className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-atlantic-500"></span>
            AtlanticSource
          </Link>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">ADMIN</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link
            href="/admin/suppliers"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition"
          >
            <Building2 className="w-4 h-4 text-atlantic-400" />
            Supplier Directory
          </Link>

          <Link
            href="/admin/suppliers/import"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition"
          >
            <Upload className="w-4 h-4 text-atlantic-400" />
            CSV Import Wizard
          </Link>

          <Link
            href="/admin/crawler"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition"
          >
            <Globe className="w-4 h-4 text-atlantic-400" />
            Crawler Dashboard
          </Link>

          <Link
            href="/admin/review"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition"
          >
            <CheckSquare className="w-4 h-4 text-atlantic-400" />
            Extraction Review Queue
          </Link>

          <Link
            href="/admin/taxonomy"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition"
          >
            <Tags className="w-4 h-4 text-atlantic-400" />
            Taxonomy Manager
          </Link>

          <Link
            href="/admin/claims"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition"
          >
            <ShieldAlert className="w-4 h-4 text-atlantic-400" />
            Claim Requests
          </Link>

          <Link
            href="/admin/freshness"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition"
          >
            <Activity className="w-4 h-4 text-atlantic-400" />
            Freshness & Recrawl
          </Link>

          <Link
            href="/admin/audit"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition"
          >
            <History className="w-4 h-4 text-atlantic-400" />
            Audit Logs
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">GTEX Platform Operations Console</h2>
          <div className="flex items-center gap-3">
            {session?.isPlatformAdmin ? (
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-medium flex items-center gap-1.5 shadow-sm">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Platform Admin ({session.email})
              </span>
            ) : (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-medium flex items-center gap-1.5 shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Session ({session?.email || "Unauthenticated"}) — Platform Admin Required
              </span>
            )}
          </div>
        </header>

        <div className="p-8 flex-1">{children}</div>
      </main>
    </div>
  );
}
