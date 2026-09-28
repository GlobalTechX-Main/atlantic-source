import React from "react";

export default function DataSourcesPage() {
  return (
    <div className="text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Data Sources & Provenance</h1>
          <p className="text-slate-500 text-sm mt-1">
            Understanding how supplier intelligence is extracted, verified, and published.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6 text-sm text-slate-600">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">1. Public Company Websites</h2>
            <p>
              AtlanticSource indexes public company websites for industrial suppliers operating in New Brunswick (Fredericton, Saint John, Moncton) and Atlantic Canada across 12 core category domains (Structural Steel, Stainless Steel, Pipe Fabrication, Machining, Welding, Electrical Contracting, Mechanical/HVAC, Plumbing, Field Installation, Equipment Maintenance, Instrumentation, Industrial Cleaning).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">2. Deterministic Extraction Pipeline</h2>
            <p>
              Our crawler extracts capability claims, physical location details, and business contact information deterministically using structured JSON-LD schemas, meta tags, contact parsers, and explicit taxonomy term matching.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">3. Verification Badges & Provenance State</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs font-bold text-slate-600 uppercase">Publicly Discovered</div>
                <p className="text-[11px] text-slate-500">Extracted from public website with explicit URL and text snippet provenance.</p>
              </div>
              <div className="bg-atlantic-50 p-4 rounded-xl border border-atlantic-200 space-y-1">
                <div className="text-xs font-bold text-atlantic-700 uppercase">Supplier Provided</div>
                <p className="text-[11px] text-slate-500">Added or updated directly by verified company representatives via portal.</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-1">
                <div className="text-xs font-bold text-emerald-700 uppercase">AtlanticSource Verified</div>
                <p className="text-[11px] text-slate-500">Reviewed and verified by AtlanticSource platform admin team.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
