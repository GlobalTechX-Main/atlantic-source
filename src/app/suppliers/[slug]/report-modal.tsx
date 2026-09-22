"use client";

import { useState } from "react";
import { submitSupplierReportAction, ReportSupplierInput } from "@/lib/actions/reports";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

interface ReportModalProps {
  supplierCompanyId: string;
  companyName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SupplierReportModal({ supplierCompanyId, companyName, isOpen, onClose }: ReportModalProps) {
  const [reportType, setReportType] = useState<ReportSupplierInput["reportType"]>("INACCURATE_INFORMATION");
  const [reporterEmail, setReporterEmail] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [details, setDetails] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    const res = await submitSupplierReportAction({
      supplierCompanyId,
      reporterEmail,
      reporterName,
      reportType,
      details,
    });

    setIsSubmitting(false);

    if (res.success) {
      setStatusMessage({ type: "success", text: res.message });
      setTimeout(() => {
        onClose();
        setStatusMessage(null);
        setDetails("");
      }, 2500);
    } else {
      setStatusMessage({ type: "error", text: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">Report Inaccurate Supplier Information</h3>
          <p className="text-xs text-slate-500">
            Submit a report for administrative review regarding <strong>{companyName}</strong>.
          </p>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Issue Category</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportSupplierInput["reportType"])}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
            >
              <option value="INACCURATE_INFORMATION">General Inaccurate Information</option>
              <option value="WRONG_CONTACT">Wrong / Outdated Contact Data</option>
              <option value="WRONG_CAPABILITY">Incorrect Capability Claim</option>
              <option value="OUTDATED_COMPANY">Outdated Company Details</option>
              <option value="COMPANY_CLOSED">Business Closed / Defunct</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Your Email (Required)</label>
              <input
                type="email"
                required
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Your Name (Optional)</label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Details & Evidence</label>
            <textarea
              required
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe the inaccurate capability, wrong contact, or closed status in detail..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-atlantic-600 text-white font-bold rounded-lg hover:bg-atlantic-700 transition disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
