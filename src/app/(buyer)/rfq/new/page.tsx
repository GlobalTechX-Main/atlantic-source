"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupplierCart } from "@/components/rfq/SupplierCart";

export default function NewRFQPage() {
  const router = useRouter();
  const { selectedSuppliers, removeSupplier, clearCart } = useSupplierCart();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Fredericton");
  const [province, setProvince] = useState("NB");
  const [responseDeadline, setResponseDeadline] = useState("");
  const [quantity, setQuantity] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent, sendImmediately: boolean = false) => {
    e.preventDefault();
    setError(null);

    if (selectedSuppliers.length === 0) {
      setError("Please select at least one supplier before creating a sourcing request.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerOrganizationId: "org_buyer_1",
          title,
          description,
          city,
          province,
          responseDeadline: responseDeadline ? new Date(responseDeadline).toISOString() : null,
          quantity: quantity || null,
          budget: budget ? parseFloat(budget) : null,
          notes: notes || null,
          supplierCompanyIds: selectedSuppliers.map((s) => s.id),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create sourcing request");
      }

      const rfqId = data.rfq.id;

      if (sendImmediately) {
        const sendRes = await fetch(`/api/rfq/${rfqId}/send`, { method: "POST" });
        const sendData = await sendRes.json();
        if (!sendRes.ok) {
          throw new Error(sendData.error || "RFQ saved as draft, but sending failed.");
        }
      }

      clearCart();
      router.push(`/buyer/rfq/${rfqId}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Create Sourcing Request (RFQ)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Send concise sourcing requests directly to qualified Atlantic Canadian suppliers.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Selected Suppliers ({selectedSuppliers.length})
              </h2>
              <span className="text-xs text-slate-500">Max 20 suppliers per request</span>
            </div>

            {selectedSuppliers.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 text-sm">
                No suppliers selected yet. Search the database and click &quot;Add to Sourcing Request&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="flex items-center justify-between p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{supplier.name}</div>
                      <div className="text-slate-500">{supplier.location || "Atlantic Canada"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSupplier(supplier.id)}
                      className="text-slate-500 hover:text-rose-600 text-xs px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Request Details</h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Sourcing Title <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Structural Steel Fabrication for Industrial Building"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-atlantic-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Detailed Scope of Work <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe material requirements, specifications, standards, and required deliverables..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-atlantic-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-atlantic-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Province</label>
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-atlantic-500"
                >
                  <option value="NB">New Brunswick (NB)</option>
                  <option value="NS">Nova Scotia (NS)</option>
                  <option value="NL">Newfoundland & Labrador (NL)</option>
                  <option value="PE">Prince Edward Island (PE)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Response Deadline
                </label>
                <input
                  type="date"
                  value={responseDeadline}
                  onChange={(e) => setResponseDeadline(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-atlantic-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Estimated Quantity (Optional)
                </label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 50 metric tons, 1,200 units"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-atlantic-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Estimated Budget CAD (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 75000.00"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-atlantic-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Special Instructions / Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any access requirements, safety orientation notes, or delivery terms..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-atlantic-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, true)}
              className="bg-atlantic-600 hover:bg-atlantic-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-colors flex items-center gap-2"
            >
              {loading ? "Processing..." : "Send Sourcing Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
