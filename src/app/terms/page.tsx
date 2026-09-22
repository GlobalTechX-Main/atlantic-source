import React from "react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-xs text-sky-400 hover:underline mb-2 inline-block font-medium">
            ← Back to AtlanticSource
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">Terms of Service</h1>
          <p className="text-slate-400 text-sm mt-1">
            Platform usage terms, disclaimers, and indicative quote conditions.
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-6 text-sm text-slate-300">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">1. Platform Scope & Purpose</h2>
            <p>
              AtlanticSource is a B2B supplier-intelligence and sourcing request platform. It facilitates discovery, matching, concise outreach, and preliminary quote exchanges between commercial buyers and Atlantic Canadian industrial suppliers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">2. Non-Binding Indicative Quotes</h2>
            <p>
              All pricing, lead times, or terms submitted through AtlanticSource response links are strictly non-binding indicative estimates. AtlanticSource does not execute binding legal contracts, handle payments, escrow, or project management. Commercial agreements must be executed directly between buyer and supplier.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">3. Acceptable Use & Rate Limits</h2>
            <p>
              Users agree not to utilize the platform for unsolicited spam, automated scraping, or submitting abusive sourcing requests. Rate limits and supplier recipient caps (max 20 suppliers per request) are enforced to prevent platform abuse.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
