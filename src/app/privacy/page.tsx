import React from "react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-xs text-sky-400 hover:underline mb-2 inline-block font-medium">
            ← Back to AtlanticSource
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-slate-400 text-sm mt-1">
            Information handling practices and PIPEDA compliance context for AtlanticSource.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-6 text-sm text-slate-300">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">1. Scope & Business Contact Data</h2>
            <p>
              AtlanticSource indexes public business website information for Atlantic Canadian industrial service providers (New Brunswick, Nova Scotia, Newfoundland & Labrador, Prince Edward Island). We collect business contact information (Company Name, Business Phone, Business Email, Work Title, Physical Address) for the purpose of facilitating B2B supplier discovery and sourcing requests.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">2. Public Crawler & Data Provenance</h2>
            <p>
              Capability claims, certification mentions, and service locations are extracted from public company websites via our automated crawler (<code className="text-sky-300">AtlanticSourceBot/1.0</code>). All extracted claims preserve explicit source provenance (URL, character offset, raw text snippet) and start in an unreviewed draft state prior to human admin review.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">3. Correction & Removal Requests</h2>
            <p>
              Suppliers or individuals can request updates, corrections, or removal of stale business listings at any time using our public{" "}
              <Link href="/report-stale" className="text-sky-400 underline font-medium">
                Correction Request Form
              </Link>
              . Verified company representatives may also claim their profile to manage information directly.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">4. Legal & Privacy Notice</h2>
            <p>
              This document is provided for market-validation transparency. Formal commercial operation requires final legal review under Canadian federal and provincial privacy legislation (PIPEDA, CASL).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
