"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ShieldAlert, Loader2, Bot, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Layers } from "lucide-react";
import { approveClaimAction, rejectClaimAction, markClaimStaleAction } from "@/lib/actions/review";

export interface SupportingClaimRefUI {
  id: string;
  rawValue: string;
  evidenceText?: string | null;
  extractionMethod: string;
  confidence: number;
  sourceUrl?: string | null;
}

export interface CanonicalClaimFactUI {
  canonicalId: string;
  supplierCompanyId: string;
  supplierName: string;
  claimType: string;
  rawValue: string;
  normalizedValue: string;
  supportingClaims: SupportingClaimRefUI[];
  supportingSourcesCount: number;
  sourceUrls: string[];
  strongestConfidence: number;
  extractionMethods: string[];
  hasContradictions: boolean;
  contradictionReason?: string;
  reviewState: string;
  validationDecision?: string | null;
  validationRisk?: string | null;
  validationReason?: string | null;
  validationConfidence?: number | null;
  validationActor?: string | null;
}

export function ReviewClaimCard({ fact }: { fact: CanonicalClaimFactUI }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const primaryClaimId = fact.supportingClaims[0]?.id || fact.canonicalId;
  const supportingClaimIds = fact.supportingClaims.map((c) => c.id);

  async function handleApprove() {
    setIsPending(true);
    setFeedback(null);
    try {
      const result = await approveClaimAction(primaryClaimId, {
        claimType: fact.claimType,
        normalizedValue: fact.normalizedValue,
        supportingClaimIds,
      });
      if (result.success) {
        setFeedback("Canonical Fact Approved & Published!");
        router.refresh();
      } else {
        alert("error" in result ? result.error : "Approval failed");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error approving canonical fact");
    } finally {
      setIsPending(false);
    }
  }

  async function handleReject() {
    setIsPending(true);
    setFeedback(null);
    try {
      const result = await rejectClaimAction(primaryClaimId, "Rejected by admin", supportingClaimIds);
      if (result.success) {
        setFeedback("Canonical Fact Rejected");
        router.refresh();
      } else {
        alert("error" in result ? result.error : "Rejection failed");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error rejecting claim");
    } finally {
      setIsPending(false);
    }
  }

  async function handleStale() {
    setIsPending(true);
    setFeedback(null);
    try {
      const result = await markClaimStaleAction(primaryClaimId, supportingClaimIds);
      if (result.success) {
        setFeedback("Marked Stale");
        router.refresh();
      } else {
        alert("error" in result ? result.error : "Failed marking stale");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error marking stale");
    } finally {
      setIsPending(false);
    }
  }

  const isAutoApproved = fact.reviewState === "AUTO_APPROVED";
  const isAutoRejected = fact.reviewState === "AUTO_REJECTED";
  const isHumanReview = fact.reviewState === "HUMAN_REVIEW" || fact.reviewState === "UNREVIEWED";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-atlantic-700 uppercase tracking-wider bg-atlantic-50 px-2 py-0.5 rounded border border-atlantic-200">
              {fact.claimType}
            </span>

            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-500" />
              Supported by {fact.supportingSourcesCount} {fact.supportingSourcesCount === 1 ? "page" : "pages"} ({fact.supportingClaims.length} mentions)
            </span>

            {isAutoApproved && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <Bot className="w-3 h-3 text-emerald-600" /> Auto-Approved (Low Risk)
              </span>
            )}
            {isAutoRejected && (
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                <Bot className="w-3 h-3 text-rose-600" /> Auto-Rejected (Low Risk)
              </span>
            )}
            {isHumanReview && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> Human Exception Queue
              </span>
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-900">{fact.rawValue}</h3>
          <p className="text-xs text-slate-500">{fact.supplierName}</p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-500 font-mono">
            Confidence: {(fact.strongestConfidence * 100).toFixed(0)}%
          </span>
          <p className="text-xs text-slate-400 font-mono truncate max-w-[180px]">
            {fact.extractionMethods.join(", ")}
          </p>
        </div>
      </div>

      {/* Contradiction Warning */}
      {fact.hasContradictions && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>
            <strong>Contradiction Warning:</strong> {fact.contradictionReason || "Conflicting evidence snippets found across pages."}
          </span>
        </div>
      )}

      {/* Validation Reason / Rationale */}
      {fact.validationReason && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 space-y-1">
          <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
            <span>Actor: <strong>{fact.validationActor || "SYSTEM_VALIDATOR"}</strong></span>
            <span>Risk Level: <strong>{fact.validationRisk || "LOW"}</strong></span>
          </div>
          <p className="font-medium text-slate-800">Rationale: {fact.validationReason}</p>
        </div>
      )}

      {/* Certification Provenance Rule Notice */}
      {fact.claimType === "CERTIFICATION" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Certification Provenance Rule:</strong> Approving creates a <code>SupplierCertification</code> with <code>PUBLICLY_DISCOVERED</code> provenance in <code>UNREVIEWED</code> state.
          </span>
        </div>
      )}

      {/* Inspect Evidence Button & Expandable Evidence Panel */}
      <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="w-full px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center justify-between transition"
        >
          <span>[Inspect Evidence] ({fact.supportingClaims.length} supporting extractions across {fact.supportingSourcesCount} URLs)</span>
          {showEvidence ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {showEvidence && (
          <div className="p-3 border-t border-slate-200 space-y-3 bg-white text-xs">
            {fact.supportingClaims.map((claim, idx) => (
              <div key={claim.id || idx} className="border-b border-slate-100 last:border-0 pb-2 space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold text-slate-700">Mention #{idx + 1} ({claim.extractionMethod})</span>
                  <span className="font-mono text-[11px]">Confidence: {(claim.confidence * 100).toFixed(0)}%</span>
                </div>
                <p className="text-slate-800 italic font-serif bg-slate-50 p-2 rounded border border-slate-100">
                  &quot;{claim.evidenceText || "No text snippet locatable"}&quot;
                </p>
                {claim.sourceUrl && (
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
                    <span>Source:</span>
                    <a href={claim.sourceUrl} target="_blank" rel="noreferrer" className="text-atlantic-600 underline flex items-center gap-0.5">
                      {claim.sourceUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {feedback && <div className="text-xs font-bold text-emerald-700">{feedback}</div>}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={handleStale}
          disabled={isPending}
          className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded hover:bg-slate-200 disabled:opacity-50 transition"
        >
          Mark Stale
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded hover:bg-rose-100 disabled:opacity-50 transition flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          Reject Fact
        </button>
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="px-4 py-1.5 bg-atlantic-600 text-white text-xs font-bold rounded hover:bg-atlantic-700 disabled:opacity-50 transition flex items-center gap-1 shadow-sm"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Approve & Publish Canonical Fact
        </button>
      </div>
    </div>
  );
}
