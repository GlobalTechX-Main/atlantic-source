import React from "react";
import Link from "next/link";

export default function DataSourcesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-xs text-sky-400 hover:underline mb-2 inline-block font-medium">
            ← Back to AtlanticSource
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">Data Sources & Provenance</h1>
          <p className="text-slate-400 text-sm mt-1">
            Understanding how supplier intelligence is extracted, verified, and published.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-6 text-sm text-slate-300">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">1. Public Company Websites</h2>
            <p>
              AtlanticSource indexes public company websites for industrial suppliers operating in New Brunswick (Fredericton, Saint John, Moncton) and Atlantic Canada across 12 core category domains (Structural Steel, Stainless Steel, Pipe Fabrication, Machining, Welding, Electrical Contracting, Mechanical/HVAC, Plumbing, Field Installation, Equipment Maintenance, Instrumentation, Industrial Cleaning).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">2. Deterministic Extraction Pipeline</h2>
            <p>
              Our crawler extracts capability claims, physical location details, and business contact information deterministically using structured JSON-LD schemas, meta tags, contact parsers, and explicit taxonomy term matching.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">3. Verification Badges & Provenance State</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-1">
                <div className="text-xs font-bold text-slate-300 uppercase">Publicly Discovered</div>
                <p className="text-[11px] text-slate-400">Extracted from public website with explicit URL and text snippet provenance.</p>
              </div>
              <div className="bg-sky-950/60 p-4 rounded-xl border border-sky-800/50 space-y-1">
                <div className="text-xs font-bold text-sky-300 uppercase">Supplier Provided</div>
                <p className="text-[11px] text-slate-400">Added or updated directly by verified company representatives via portal.</p>
              </div>
              <div className="bg-emerald-950/60 p-4 rounded-xl border border-emerald-800/50 space-y-1">
                <div className="text-xs font-bold text-emerald-300 uppercase">AtlanticSource Verified</div>
                <p className="text-[11px] text-slate-400">Reviewed and verified by AtlanticSource platform admin team.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
