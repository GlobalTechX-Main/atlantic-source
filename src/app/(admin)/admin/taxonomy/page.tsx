import { db } from "@/lib/db";
import { Tags } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaxonomyManagerPage() {
  let capabilities: Array<{
    id: string;
    canonicalName: string;
    slug: string;
    aliases: { alias: string }[];
  }> = [];

  try {
    if (process.env.NODE_ENV !== "test") {
      capabilities = await db.capability.findMany({
        include: {
          aliases: true,
        },
        orderBy: {
          canonicalName: "asc",
        },
      });
    }
  } catch (err) {
    console.error("Failed to load capabilities for taxonomy manager:", err);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Taxonomy Manager</h1>
          <p className="text-sm text-slate-500">Maintain canonical capabilities, aliases, industries, certifications, equipment, and service regions.</p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-700 font-mono px-3 py-1.5 rounded-lg border border-slate-200">
          {capabilities.length} Canonical Capabilities
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Tags className="w-4 h-4 text-atlantic-600" />
            Capabilities & Approved Aliases ({capabilities.length})
          </h3>
        </div>

        {capabilities.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No capabilities found in database taxonomy. Run database seed to populate taxonomies.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Canonical Capability Name</th>
                <th className="px-6 py-3 font-semibold">Slug</th>
                <th className="px-6 py-3 font-semibold">Mapped Aliases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {capabilities.map((cap) => (
                <tr key={cap.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{cap.canonicalName}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{cap.slug}</td>
                  <td className="px-6 py-4 text-xs">
                    {cap.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {cap.aliases.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono">
                            {a.alias}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No aliases</span>
                    )}
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
