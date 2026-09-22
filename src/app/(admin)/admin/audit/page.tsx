import { db } from "@/lib/db";
import { History } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  let auditLogs: Array<{
    id: string;
    actorUserId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata: string | null;
    createdAt: Date;
    actorUser?: { email: string } | null;
  }> = [];

  try {
    if (process.env.NODE_ENV !== "test") {
      auditLogs = await db.auditLog.findMany({
        include: {
          actorUser: {
            select: { email: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      });
    }
  } catch (err) {
    console.error("Failed to load audit logs:", err);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Security Audit Logs</h1>
          <p className="text-sm text-slate-500">Immutable security audit record of administrative actions, publication changes, and claim approvals.</p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-700 font-mono px-3 py-1.5 rounded-lg border border-slate-200">
          {auditLogs.length} Audit Events
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-atlantic-600" />
            Audit Action Trait Log
          </h3>
          <span className="text-xs text-slate-500 font-mono">Sensitive fields auto-redacted</span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No audit events recorded yet. Perform admin operations (supplier creation, claim approvals) to view audit entries.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Timestamp</th>
                <th className="px-6 py-3 font-semibold">Actor</th>
                <th className="px-6 py-3 font-semibold">Action</th>
                <th className="px-6 py-3 font-semibold">Target Entity</th>
                <th className="px-6 py-3 font-semibold">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4 text-slate-800 font-medium">{log.actorUser?.email || log.actorUserId || "System/Admin"}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 font-bold rounded bg-slate-100 text-slate-800 border border-slate-300">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{log.targetType} ({log.targetId})</td>
                  <td className="px-6 py-4 text-slate-600 truncate max-w-xs">{log.metadata || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
