import React from "react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-slate-500 text-sm mt-1">
            Information handling practices and PIPEDA compliance context for Suplist.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6 text-sm text-slate-600">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">1. Scope & Business Contact Data</h2>
            <p>
              Suplist indexes public business website information for Atlantic Canadian industrial service providers (New Brunswick, Nova Scotia, Newfoundland & Labrador, Prince Edward Island). We collect business contact information (Company Name, Business Phone, Business Email, Work Title, Physical Address) for the purpose of facilitating B2B supplier discovery and sourcing requests.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">2. Public Crawler & Data Provenance</h2>
            <p>
              Capability claims, certification mentions, and service locations are extracted from public company websites via our automated crawler (<code className="text-atlantic-700">SuplistBot/1.0</code>). All extracted claims preserve explicit source provenance (URL, character offset, raw text snippet) and start in an unreviewed draft state prior to human admin review.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">3. Correction & Removal Requests</h2>
            <p>
              Suppliers or individuals can request updates, corrections, or removal of stale business listings at any time using our public{" "}
              <Link href="/report-stale" className="text-atlantic-600 underline font-medium">
                Correction Request Form
              </Link>
              . Verified company representatives may also claim their profile to manage information directly.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900">4. Legal & Privacy Notice</h2>
            <p>
              This document is provided for market-validation transparency. Formal commercial operation requires final legal review under Canadian federal and provincial privacy legislation (PIPEDA, CASL).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
