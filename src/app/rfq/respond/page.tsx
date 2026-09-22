"use client";

export const dynamic = "force-dynamic";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface RFQResponseData {
  response: {
    status: string;
  };
  supplierCompany: {
    name: string;
  };
  sourcingRequest: {
    buyerName: string;
    title: string;
    description: string;
  };
  claimCTA: {
    message: string;
    url: string;
  };
}

function ResponseContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RFQResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [indicativeQuote, setIndicativeQuote] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [leadTime, setLeadTime] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing response token. Please click the response link provided in your email.");
      setLoading(false);
      return;
    }

    fetch("/api/rfq/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "Failed to verify response token");
        setData(d as RFQResponseData);
      })
      .catch((err: unknown) => {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Failed to verify response token");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !indicativeQuote) return;

    setSubmittingQuote(true);
    setQuoteSuccess(null);

    try {
      const res = await fetch("/api/rfq/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "QUOTE",
          token,
          indicativeQuote,
          currency,
          leadTime,
          message: quoteMessage,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to submit quote");

      setQuoteSuccess("Indicative quote submitted successfully!");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to submit quote");
      }
    } finally {
      setSubmittingQuote(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-sm font-medium text-slate-400">Verifying secure response token...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h1 className="text-xl font-bold text-white">Invalid or Expired Token</h1>
          <p className="text-xs text-slate-400">{error || "Token validation failed."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="bg-emerald-950/80 border border-emerald-800/60 rounded-2xl p-6 shadow-xl flex items-start gap-4">
          <div className="w-10 h-10 bg-emerald-900/60 text-emerald-300 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
            ✓
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-white">
              Response Recorded: <span className="uppercase text-emerald-400">{data.response.status}</span>
            </h1>
            <p className="text-xs text-emerald-200/80">
              Thank you, <strong className="text-white">{data.supplierCompany.name}</strong>. Your response has been transmitted to <strong className="text-white">{data.sourcingRequest.buyerName}</strong>.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Sourcing Request Details
          </h2>
          <div className="text-xl font-bold text-white">{data.sourcingRequest.title}</div>
          <p className="text-xs text-slate-300 whitespace-pre-wrap">{data.sourcingRequest.description}</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-semibold text-white">Provide Indicative Quote (Optional)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit preliminary pricing or lead time. Clearly labeled as non-binding supplier estimate.
            </p>
          </div>

          {quoteSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-lg text-xs">
              {quoteSuccess}
            </div>
          )}

          <form onSubmit={handleQuoteSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Indicative Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={indicativeQuote}
                  onChange={(e) => setIndicativeQuote(e.target.value)}
                  placeholder="e.g. 12500.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="CAD">CAD ($)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Estimated Lead Time</label>
                <input
                  type="text"
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  placeholder="e.g. 2-3 weeks"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Additional Notes / Assumptions</label>
              <textarea
                rows={3}
                value={quoteMessage}
                onChange={(e) => setQuoteMessage(e.target.value)}
                placeholder="Include key assumptions, material inclusions/exclusions..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-500 italic">
                * Indicative pricing only. Does not create a binding legal agreement.
              </span>
              <button
                type="submit"
                disabled={submittingQuote}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-lg text-xs transition-colors shadow"
              >
                {submittingQuote ? "Submitting..." : "Submit Indicative Quote"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-gradient-to-r from-sky-950/60 to-indigo-950/60 border border-sky-800/40 rounded-2xl p-6 text-center space-y-3">
          <h3 className="text-base font-bold text-white">Manage Your AtlanticSource Supplier Profile</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            {data.claimCTA.message}
          </p>
          <a
            href={data.claimCTA.url}
            className="inline-block bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow transition-colors"
          >
            Claim Company Profile →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SupplierRFQResponsePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="text-sm font-medium text-slate-400">Loading response page...</div>
        </div>
      }
    >
      <ResponseContent />
    </Suspense>
  );
}
