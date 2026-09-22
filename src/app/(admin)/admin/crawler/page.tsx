import Link from "next/link";
import { db } from "@/lib/db";
import { Globe, RefreshCw, CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react";
import { RetryCrawlButton } from "./RetryCrawlButton";

export const dynamic = "force-dynamic";

export default async function CrawlerDashboardPage() {
  let crawlRuns: Array<{
    id: string;
    seedUrl: string;
    status: string;
    pagesDiscovered: number;
    pagesFetched: number;
    startedAt: Date | null;
    completedAt: Date | null;
    errorSummary: string | null;
    supplierCompany: {
      id: string;
      canonicalName: string;
      normalizedDomain: string | null;
    };
    sourceDocuments: { id: string }[];
  }> = [];

  try {
    if (process.env.NODE_ENV !== "test") {
      crawlRuns = await db.crawlRun.findMany({
        include: {
          supplierCompany: {
            select: {
              id: true,
              canonicalName: true,
              normalizedDomain: true,
            },
          },
          sourceDocuments: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }
  } catch (err) {
    console.error("Failed to load CrawlRun records for dashboard:", err);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Safe Crawler Dashboard</h1>
          <p className="text-sm text-slate-500">Monitor active crawl runs, SSRF guard checks, page discovery, and source documents.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
            {crawlRuns.length} Crawl Runs
          </span>
        </div>
      </div>

      {/* Crawl Jobs Overview */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-atlantic-600" />
            Crawl Jobs History ({crawlRuns.length})
          </h3>
        </div>

        {crawlRuns.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm space-y-3">
            <Globe className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-medium text-slate-800">No crawl runs queued yet.</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Go to the <Link href="/admin/suppliers" className="text-atlantic-600 underline font-semibold">Supplier Directory</Link> and click <strong>Queue Crawl</strong> on any supplier company with a website URL.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Supplier Company</th>
                <th className="px-6 py-3 font-semibold">Target Domain</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Pages Discovered / Fetched</th>
                <th className="px-6 py-3 font-semibold">Started / Completed</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {crawlRuns.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{run.supplierCompany.canonicalName}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs truncate max-w-xs">{run.seedUrl}</td>
                  <td className="px-6 py-4">
                    {run.status === "COMPLETED" ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        COMPLETED
                      </span>
                    ) : run.status === "RUNNING" ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        RUNNING
                      </span>
                    ) : run.status === "PENDING" ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        QUEUED
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        FAILED
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                    {run.pagesDiscovered} discovered / {run.pagesFetched} fetched
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/review?supplierId=${run.supplierCompany.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded hover:bg-slate-200 transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Inspect ({run.sourceDocuments.length})
                      </Link>
                      <RetryCrawlButton supplierId={run.supplierCompany.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
