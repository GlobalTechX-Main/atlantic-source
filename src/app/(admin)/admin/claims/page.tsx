import { db } from "@/lib/db";
import { ClaimRequestCard, ClaimRequestItem } from "./ClaimRequestCard";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClaimRequestsPage() {
  let claimRequests: ClaimRequestItem[] = [];

  try {
    if (process.env.NODE_ENV !== "test") {
      claimRequests = await db.companyClaimRequest.findMany({
        where: {
          status: "PENDING",
        },
        include: {
          supplierCompany: {
            select: { canonicalName: true },
          },
          requestingUser: {
            select: { email: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }
  } catch (err) {
    console.error("Failed to load claim requests:", err);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company Claim Verification Requests</h1>
          <p className="text-sm text-slate-500">Review business ownership claim requests submitted by regional suppliers.</p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-700 font-mono px-3 py-1.5 rounded-lg border border-slate-200">
          {claimRequests.length} Pending Claims
        </span>
      </div>

      {claimRequests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Pending Claim Requests</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All supplier company claim verification requests have been processed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {claimRequests.map((req) => (
            <ClaimRequestCard key={req.id} req={req} />
          ))}
        </div>
      )}
    </div>
  );
}
