import Link from "next/link";
import { verifyDomainClaimToken } from "@/lib/supplier/claiming";
import { ShieldCheck, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

interface ClaimVerifyPageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function ClaimVerifyPage({ searchParams }: ClaimVerifyPageProps) {
  const { token } = await searchParams;

  let verificationResult: { success: boolean; supplierCompanyId: string; userId: string } | null = null;
  let errorMessage: string | null = null;

  if (token) {
    try {
      verificationResult = await verifyDomainClaimToken(token);
    } catch (err: unknown) {
      errorMessage = (err as Error).message || "Domain verification token is invalid or expired.";
    }
  } else {
    errorMessage = "No verification token provided.";
  }

  return (
    <div className="max-w-xl mx-auto py-16 px-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl text-center space-y-6">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto bg-atlantic-50 text-atlantic-600">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900">
          Supplier Domain Claim Verification
        </h1>

        {verificationResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>Company Domain Control Confirmed! You are now granted Supplier Admin access.</span>
            </div>

            <p className="text-xs text-slate-600">
              Your company claim has been verified automatically via corporate email domain control. You can now access your Supplier Portal to manage capabilities, certifications, and RFQ opportunities.
            </p>

            <Link
              href="/portal"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-atlantic-600 text-white font-bold text-sm rounded-xl hover:bg-atlantic-700 transition shadow"
            >
              Go to Supplier Portal
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>

            <p className="text-xs text-slate-500">
              If your link expired or failed, you can re-initiate domain verification or submit official document proof for GTEX manual admin review.
            </p>

            <div className="pt-2 flex justify-center gap-4 text-xs">
              <Link href="/suppliers" className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition">
                Return to Directory
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
