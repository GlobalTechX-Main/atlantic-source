"use client";

import React, { useState } from "react";

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
    <div className="text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Report Stale or Incorrect Profile</h1>
          <p className="text-slate-500 text-sm mt-1">
            Submit corrections for outdated business details, wrong contacts, or inaccurate capabilities.
          </p>
        </div>

        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xl mx-auto">
              ✓
            </div>
            <h2 className="text-lg font-bold text-slate-900">Correction Request Submitted</h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Thank you for helping keep Suplist accurate. Our admin team will review your report against public provenance records.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Company Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Saint John Steel Fabrication Ltd."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-atlantic-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Your Email <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-atlantic-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Issue Category</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-atlantic-500"
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
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Correction Details <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide accurate information or link to updated official company page..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-atlantic-500"
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="bg-atlantic-600 hover:bg-atlantic-700 text-white font-semibold px-6 py-2.5 rounded-xl text-xs shadow transition-colors"
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
