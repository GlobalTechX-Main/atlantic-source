"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { createManualSupplierAction } from "@/lib/actions/suppliers";

export function ManualSupplierForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [city, setCity] = useState("Fredericton");
  const [publicPhone, setPublicPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [category, setCategory] = useState("Structural Steel Fabrication");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const result = await createManualSupplierAction({
        companyName,
        websiteUrl,
        city,
        publicPhone,
        publicEmail,
        category,
      });

      if (!result.success) {
        setErrorMessage(result.error || "Failed to create supplier");
      } else {
        setSuccessMessage(`Supplier "${companyName}" created successfully in DRAFT state.`);
        setCompanyName("");
        setWebsiteUrl("");
        setPublicPhone("");
        setPublicEmail("");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected network or server error occurred";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Plus className="w-4 h-4 text-atlantic-600" />
        Create Supplier Manually
      </h3>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Company Name *</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Fredericton Precision Machining"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-atlantic-500 outline-none disabled:bg-slate-100 disabled:opacity-60"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Website URL *</label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://frederictonprecision.ca"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-atlantic-500 outline-none disabled:bg-slate-100 disabled:opacity-60"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-atlantic-500 outline-none disabled:bg-slate-100 disabled:opacity-60"
            disabled={isSubmitting}
          >
            <option value="Fredericton">Fredericton</option>
            <option value="Saint John">Saint John</option>
            <option value="Moncton">Moncton</option>
            <option value="Other NB">Other New Brunswick</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Public Phone (Optional)</label>
          <input
            type="text"
            value={publicPhone}
            onChange={(e) => setPublicPhone(e.target.value)}
            placeholder="506-555-0199"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-atlantic-500 outline-none disabled:bg-slate-100 disabled:opacity-60"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Public Email (Optional)</label>
          <input
            type="email"
            value={publicEmail}
            onChange={(e) => setPublicEmail(e.target.value)}
            placeholder="info@frederictonprecision.ca"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-atlantic-500 outline-none disabled:bg-slate-100 disabled:opacity-60"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Seed Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-atlantic-500 outline-none disabled:bg-slate-100 disabled:opacity-60"
            disabled={isSubmitting}
          >
            <option value="Structural Steel Fabrication">Structural Steel Fabrication</option>
            <option value="Machining">Machining</option>
            <option value="Welding">Welding</option>
            <option value="Pipe Fabrication">Pipe Fabrication</option>
            <option value="Electrical Contracting">Electrical Contracting</option>
            <option value="Mechanical/HVAC">Mechanical/HVAC</option>
          </select>
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-atlantic-600 text-white font-medium rounded-lg text-sm hover:bg-atlantic-700 disabled:bg-atlantic-400 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Supplier...
              </>
            ) : (
              "Save Supplier (Draft Profile)"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
