"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ReportStalePage() {
  const [supplierName, setSupplierName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [reportType, setReportType] = useState("OUTDATED_COMPANY");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-xs text-sky-400 hover:underline mb-2 inline-block font-medium">
            ← Back to AtlanticSource
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">Report Stale or Incorrect Profile</h1>
          <p className="text-slate-400 text-sm mt-1">
            Submit corrections for outdated business details, wrong contacts, or inaccurate capabilities.
          </p>
        </div>

        {submitted ? (
          <div className="bg-emerald-950/80 border border-emerald-800/60 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-900/60 text-emerald-300 rounded-full flex items-center justify-center font-bold text-xl mx-auto">
              ✓
            </div>
            <h2 className="text-lg font-bold text-white">Correction Request Submitted</h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Thank you for helping keep AtlanticSource accurate. Our admin team will review your report against public provenance records.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-6">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Company Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Saint John Steel Fabrication Ltd."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Your Email <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Issue Category</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="OUTDATED_COMPANY">Outdated Business Details</option>
                  <option value="WRONG_CONTACT">Incorrect Business Email/Phone</option>
                  <option value="WRONG_CAPABILITY">Inaccurate Capability Listing</option>
                  <option value="COMPANY_CLOSED">Business Permanently Closed</option>
                  <option value="INACCURATE_INFORMATION">Other Inaccurate Information</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Correction Details <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide accurate information or link to updated official company page..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs shadow transition-colors"
              >
                Submit Correction Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
