import { db } from "@/lib/db";
import { Activity } from "lucide-react";
import { RetryCrawlButton } from "../crawler/RetryCrawlButton";

export const dynamic = "force-dynamic";

export default async function FreshnessAuditPage() {
  let suppliers: Array<{
    id: string;
    canonicalName: string;
    websiteUrl: string | null;
    lastReviewedAt: Date | null;
    crawlRuns: { createdAt: Date; status: string; completedAt: Date | null }[];
  }> = [];

  try {
    if (process.env.NODE_ENV !== "test") {
      suppliers = await db.supplierCompany.findMany({
        include: {
          crawlRuns: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: {
          canonicalName: "asc",
        },
      });
    }
  } catch (err) {
    console.error("Failed to load freshness audit suppliers:", err);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Freshness & Recrawl Audit</h1>
          <p className="text-sm text-slate-500">Monitor stale sources, changed website evidence, and missing-source claims.</p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-700 font-mono px-3 py-1.5 rounded-lg border border-slate-200">
          {suppliers.length} Ingested Suppliers
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-atlantic-600" />
            Supplier Data Freshness Overview
          </h3>
        </div>

        {suppliers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No suppliers found. Ingest suppliers in the Supplier Directory to run freshness audits.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Supplier Company</th>
                <th className="px-6 py-3 font-semibold">Last Crawl Date</th>
                <th className="px-6 py-3 font-semibold">Last Crawl Status</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((sup) => {
                const latestRun = sup.crawlRuns[0];
                const lastCrawledStr = latestRun?.createdAt
                  ? new Date(latestRun.createdAt).toLocaleString()
                  : "Never Crawled";

                return (
                  <tr key={sup.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{sup.canonicalName}</td>
                    <td className="px-6 py-4 text-slate-600 text-xs font-mono">{lastCrawledStr}</td>
                    <td className="px-6 py-4">
                      {latestRun ? (
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded ${
                            latestRun.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : latestRun.status === "RUNNING"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : latestRun.status === "PENDING"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {latestRun.status}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-600">
                          UNCRAWLED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <RetryCrawlButton supplierId={sup.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
