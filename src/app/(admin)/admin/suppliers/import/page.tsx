"use client";

import { useState } from "react";
import { Upload, ArrowRight, CheckCircle2 } from "lucide-react";

interface CSVRowPreview {
  companyName: string;
  websiteUrl: string;
  city: string;
  phone: string;
  email: string;
  status: "CREATE" | "UPDATE_CANDIDATE" | "POSSIBLE_DUPLICATE" | "INVALID";
  reasons: string[];
}

export default function CSVImportWizardPage() {
  const [step, setStep] = useState<"UPLOAD" | "MAPPING" | "PREVIEW" | "COMMIT">("UPLOAD");

  const samplePreviewRows: CSVRowPreview[] = [
    {
      companyName: "Moncton Machine Works",
      websiteUrl: "https://monctonmachineworks.ca",
      city: "Moncton",
      phone: "506-555-0899",
      email: "sales@monctonmachineworks.ca",
      status: "CREATE",
      reasons: ["New domain & business identity"],
    },
    {
      companyName: "Saint John Industrial Steel",
      websiteUrl: "https://saintjohnsteel.example.com",
      city: "Saint John",
      phone: "506-555-0199",
      email: "info@saintjohnsteel.example.com",
      status: "UPDATE_CANDIDATE",
      reasons: ['Matches existing supplier domain "saintjohnsteel.example.com"'],
    },
    {
      companyName: "Steel Fabricators NB",
      websiteUrl: "https://steelfabnb.com",
      city: "Saint John",
      phone: "506-555-0199",
      email: "info@steelfabnb.com",
      status: "POSSIBLE_DUPLICATE",
      reasons: ['Matches public phone number "506-555-0199" of existing supplier'],
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">CSV Batch Ingestion Wizard</h1>
        <p className="text-sm text-slate-500">
          Upload regional supplier CSV files, map columns, preview deduplication signals, and confirm commits safely.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div className={`flex items-center gap-2 font-medium text-sm ${step === "UPLOAD" ? "text-atlantic-600 font-bold" : "text-slate-500"}`}>
          <span className="w-6 h-6 rounded-full bg-atlantic-100 flex items-center justify-center text-xs">1</span>
          Upload CSV
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400" />
        <div className={`flex items-center gap-2 font-medium text-sm ${step === "MAPPING" ? "text-atlantic-600 font-bold" : "text-slate-500"}`}>
          <span className="w-6 h-6 rounded-full bg-atlantic-100 flex items-center justify-center text-xs">2</span>
          Column Mapping
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400" />
        <div className={`flex items-center gap-2 font-medium text-sm ${step === "PREVIEW" ? "text-atlantic-600 font-bold" : "text-slate-500"}`}>
          <span className="w-6 h-6 rounded-full bg-atlantic-100 flex items-center justify-center text-xs">3</span>
          Deduplication Preview
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400" />
        <div className={`flex items-center gap-2 font-medium text-sm ${step === "COMMIT" ? "text-emerald-600 font-bold" : "text-slate-500"}`}>
          <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs">4</span>
          Commit Success
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === "UPLOAD" && (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 bg-atlantic-50 text-atlantic-600 rounded-full flex items-center justify-center mx-auto">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Select or Drag CSV Supplier File</h3>
            <p className="text-xs text-slate-500">Supports headers: company, website, city, province, phone, email, category</p>
          </div>
          <button
            onClick={() => {
              setStep("MAPPING");
            }}
            className="px-6 py-2.5 bg-atlantic-600 text-white text-sm font-medium rounded-lg hover:bg-atlantic-700 transition"
          >
            Upload Sample CSV
          </button>
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === "MAPPING" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Map CSV Columns to AtlanticSource Schema</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company Name Column</label>
              <select className="w-full px-3 py-2 border rounded-lg"><option>company</option></select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Website URL Column</label>
              <select className="w-full px-3 py-2 border rounded-lg"><option>website</option></select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">City Column</label>
              <select className="w-full px-3 py-2 border rounded-lg"><option>city</option></select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Column</label>
              <select className="w-full px-3 py-2 border rounded-lg"><option>phone</option></select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setStep("PREVIEW")}
              className="px-6 py-2 bg-atlantic-600 text-white text-sm font-medium rounded-lg hover:bg-atlantic-700 transition"
            >
              Generate Dry-Run Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Dry-Run Preview */}
      {step === "PREVIEW" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Deduplication & Validation Preview</h3>
            <p className="text-xs text-slate-500">Uncertain duplicates are flagged for manual review. No items are automatically merged.</p>

            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b text-slate-600">
                <tr>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Domain</th>
                  <th className="px-4 py-2">City</th>
                  <th className="px-4 py-2">Calculated Status</th>
                  <th className="px-4 py-2">Duplicate Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {samplePreviewRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.companyName}</td>
                    <td className="px-4 py-3 text-slate-600">{row.websiteUrl}</td>
                    <td className="px-4 py-3 text-slate-600">{row.city}</td>
                    <td className="px-4 py-3">
                      {row.status === "CREATE" && (
                        <span className="px-2 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                          CREATE
                        </span>
                      )}
                      {row.status === "UPDATE_CANDIDATE" && (
                        <span className="px-2 py-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          UPDATE CANDIDATE
                        </span>
                      )}
                      {row.status === "POSSIBLE_DUPLICATE" && (
                        <span className="px-2 py-1 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded">
                          POSSIBLE DUPLICATE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{row.reasons.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-xs text-slate-500 font-medium">1 CREATE, 1 UPDATE CANDIDATE, 1 POSSIBLE DUPLICATE</span>
              <button
                onClick={() => setStep("COMMIT")}
                className="px-6 py-2.5 bg-atlantic-600 text-white font-medium rounded-lg text-sm hover:bg-atlantic-700 transition"
              >
                Confirm & Commit Ingestion (2 Suppliers)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Commit Success */}
      {step === "COMMIT" && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Ingestion Committed Successfully!</h3>
          <p className="text-sm text-slate-600">
            2 supplier profiles were saved in DRAFT state. Note: Ingestion does NOT automatically crawl websites. You may queue crawls explicitly from the Crawler Dashboard.
          </p>
          <div className="pt-4 flex justify-center gap-4">
            <button
              onClick={() => setStep("UPLOAD")}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
            >
              Import Another CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
