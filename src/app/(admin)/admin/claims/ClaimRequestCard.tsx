"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, FileText, Loader2 } from "lucide-react";
import { approveCompanyClaimAction, rejectCompanyClaimAction } from "@/lib/actions/claims";

export interface ClaimRequestItem {
  id: string;
  requestedDomain: string | null;
  verificationMethod: string;
  status: string;
  createdAt: Date;
  supplierCompany: {
    canonicalName: string;
  };
  requestingUser: {
    email: string;
  };
}

export function ClaimRequestCard({ req }: { req: ClaimRequestItem }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleApprove() {
    setIsPending(true);
    setFeedback(null);
    try {
      const result = await approveCompanyClaimAction(req.id);
      if (result.success) {
        setFeedback("Approved! Supplier Admin role granted.");
        router.refresh();
      } else {
        alert("error" in result ? result.error : "Approval failed");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error approving claim request");
    } finally {
      setIsPending(false);
    }
  }

  async function handleReject() {
    setIsPending(true);
    setFeedback(null);
    try {
      const result = await rejectCompanyClaimAction(req.id, "Rejected by admin");
      if (result.success) {
        setFeedback("Claim Request Rejected.");
        router.refresh();
      } else {
        alert("error" in result ? result.error : "Rejection failed");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error rejecting claim request");
    } finally {
      setIsPending(false);
    }
  }

  const isDomainMatch = req.verificationMethod === "EMAIL_DOMAIN";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{req.supplierCompany.canonicalName}</h3>
          <p className="text-xs text-slate-500">
            Claimant Email: <span className="font-mono font-medium text-slate-800">{req.requestingUser.email}</span>
          </p>
        </div>
        <div>
          {isDomainMatch ? (
            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Domain Match Verified
            </span>
          ) : (
            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200">
              Manual Document Review Needed
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span>Method: <strong>{req.verificationMethod}</strong></span>
          {req.requestedDomain && (
            <span className="flex items-center gap-1 text-slate-500 font-mono">
              <FileText className="w-3.5 h-3.5" />
              Domain: {req.requestedDomain}
            </span>
          )}
        </div>
        <span>Submitted: {new Date(req.createdAt).toLocaleString()}</span>
      </div>

      {feedback && <div className="text-xs font-bold text-emerald-700">{feedback}</div>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={handleReject}
          disabled={isPending}
          className="px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded hover:bg-rose-100 disabled:opacity-50 transition flex items-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          Reject Claim
        </button>
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="px-4 py-1.5 bg-atlantic-600 text-white text-xs font-bold rounded hover:bg-atlantic-700 disabled:opacity-50 transition flex items-center gap-1 shadow-sm"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Approve & Grant Supplier Admin
        </button>
      </div>
    </div>
  );
}
