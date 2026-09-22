import Link from "next/link";
import { db } from "@/lib/db";
import { ReviewClaimCard, CanonicalClaimFactUI } from "./ReviewClaimCard";
import { CheckSquare, Bot, AlertTriangle, ShieldAlert, Filter } from "lucide-react";
import { runSupplierProfileQA } from "@/lib/validation/profileQA";
import { ProfileQAResult } from "@/lib/validation/types";
import { consolidateExtractedClaims } from "@/lib/validation/consolidation";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    supplierId?: string;
  }>;
}

export default async function ExtractionReviewQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentStatusFilter = params.status || "HUMAN_REVIEW";
  const currentTypeFilter = params.type || "ALL";
  const supplierIdFilter = params.supplierId;

  let canonicalFacts: CanonicalClaimFactUI[] = [];
  let totalRawClaims = 0;
  let totalCanonicalFacts = 0;
  let autoApprovedCount = 0;
  let autoRejectedCount = 0;
  let humanReviewCount = 0;
  let publishedCount = 0;
  let collapsedDuplicatesCount = 0;
  let qaResult: ProfileQAResult | null = null;

  try {
    if (process.env.NODE_ENV !== "test") {
      const allRawClaims = await db.extractedClaim.findMany({
        where: supplierIdFilter ? { supplierCompanyId: supplierIdFilter } : undefined,
        include: {
          supplierCompany: { select: { canonicalName: true } },
          sourceDocument: { select: { sourceUrl: true, pageType: true, extractedText: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      totalRawClaims = allRawClaims.length;

      // Consolidate duplicate raw claims into Canonical Facts
      const allCanonicalFacts = consolidateExtractedClaims(
        allRawClaims.map((c) => ({
          id: c.id,
          supplierCompanyId: c.supplierCompanyId,
          claimType: c.claimType,
          rawValue: c.rawValue,
          normalizedValue: c.normalizedValue,
          evidenceText: c.evidenceText,
          confidence: c.confidence,
          extractionMethod: c.extractionMethod,
          reviewState: c.reviewState,
          validationDecision: c.validationDecision,
          validationRisk: c.validationRisk,
          validationReason: c.validationReason,
          validationConfidence: c.validationConfidence,
          validationActor: c.validationActor,
          sourceDocumentId: c.sourceDocumentId,
          sourceUrl: c.sourceDocument?.sourceUrl,
          pageType: c.sourceDocument?.pageType,
          supplierCompany: c.supplierCompany,
          sourceDocument: c.sourceDocument,
        }))
      );

      totalCanonicalFacts = allCanonicalFacts.length;
      collapsedDuplicatesCount = totalRawClaims - totalCanonicalFacts;

      autoApprovedCount = allCanonicalFacts.filter((f) => f.reviewState === "AUTO_APPROVED").length;
      autoRejectedCount = allCanonicalFacts.filter((f) => f.reviewState === "AUTO_REJECTED").length;
      humanReviewCount = allCanonicalFacts.filter((f) => f.reviewState === "HUMAN_REVIEW" || f.reviewState === "UNREVIEWED").length;
      publishedCount = allCanonicalFacts.filter((f) => f.reviewState === "APPROVED" || f.reviewState === "VERIFIED").length;

      // Filter canonical facts for view
      canonicalFacts = allCanonicalFacts.filter((fact) => {
        let matchesStatus = true;
        if (currentStatusFilter === "HUMAN_REVIEW") {
          matchesStatus = fact.reviewState === "HUMAN_REVIEW" || fact.reviewState === "UNREVIEWED";
        } else if (currentStatusFilter === "AUTO_APPROVED") {
          matchesStatus = fact.reviewState === "AUTO_APPROVED";
        } else if (currentStatusFilter === "AUTO_REJECTED") {
          matchesStatus = fact.reviewState === "AUTO_REJECTED";
        }

        let matchesType = true;
        if (currentTypeFilter !== "ALL") {
          matchesType = fact.claimType === currentTypeFilter;
        }

        return matchesStatus && matchesType;
      });

      if (supplierIdFilter) {
        qaResult = await runSupplierProfileQA(supplierIdFilter);
      }
    }
  } catch (err) {
    console.error("Failed to load claims for review queue:", err);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Canonical Claims Review & Exception Queue</h1>
          <p className="text-sm text-slate-500">
            Duplicate extractions across multiple pages are consolidated into unique supplier facts for streamlined review.
          </p>
        </div>
      </div>

      {/* Summary Statistics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Canonical Facts</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCanonicalFacts}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{totalRawClaims} raw extractions ({collapsedDuplicatesCount} collapsed)</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" /> Auto-Approved
          </p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{autoApprovedCount}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Low-risk canonical facts</p>
        </div>
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" /> Auto-Rejected
          </p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{autoRejectedCount}</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Negated / invalid facts</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Needs Review
          </p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{humanReviewCount}</p>
          <p className="text-[11px] text-amber-600 mt-0.5">Human exception queue</p>
        </div>
        <div className="bg-white border border-atlantic-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-atlantic-700 uppercase tracking-wider">Published</p>
          <p className="text-2xl font-bold text-atlantic-700 mt-1">{publishedCount}</p>
          <p className="text-[11px] text-atlantic-600 mt-0.5">Verified supplier facts</p>
        </div>
      </div>

      {/* Profile QA Consistency Alert */}
      {qaResult && qaResult.hasInconsistencies && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Profile-Level QA Consistency Warnings ({qaResult.supplierName})</span>
          </div>
          <ul className="text-xs text-amber-800 list-disc list-inside space-y-1">
            {qaResult.qaFlags.map((flag, idx) => (
              <li key={idx}>
                <strong>[{flag.code}]</strong>: {flag.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filter Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        {/* Decision Filter */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <Link
            href={`/admin/review?status=HUMAN_REVIEW${currentTypeFilter !== "ALL" ? `&type=${currentTypeFilter}` : ""}`}
            className={`px-3 py-1.5 rounded-lg border transition ${
              currentStatusFilter === "HUMAN_REVIEW"
                ? "bg-amber-50 text-amber-800 border-amber-300 font-bold shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            Needs Review ({humanReviewCount})
          </Link>
          <Link
            href={`/admin/review?status=AUTO_APPROVED${currentTypeFilter !== "ALL" ? `&type=${currentTypeFilter}` : ""}`}
            className={`px-3 py-1.5 rounded-lg border transition ${
              currentStatusFilter === "AUTO_APPROVED"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            Auto-Approved ({autoApprovedCount})
          </Link>
          <Link
            href={`/admin/review?status=AUTO_REJECTED${currentTypeFilter !== "ALL" ? `&type=${currentTypeFilter}` : ""}`}
            className={`px-3 py-1.5 rounded-lg border transition ${
              currentStatusFilter === "AUTO_REJECTED"
                ? "bg-rose-50 text-rose-800 border-rose-300 font-bold shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            Auto-Rejected ({autoRejectedCount})
          </Link>
          <Link
            href={`/admin/review?status=ALL${currentTypeFilter !== "ALL" ? `&type=${currentTypeFilter}` : ""}`}
            className={`px-3 py-1.5 rounded-lg border transition ${
              currentStatusFilter === "ALL"
                ? "bg-atlantic-50 text-atlantic-800 border-atlantic-300 font-bold shadow-sm"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            All Facts ({totalCanonicalFacts})
          </Link>
        </div>

        {/* Claim Type Category Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 font-medium">Group by Category:</span>
          <select
            defaultValue={currentTypeFilter}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1 font-medium focus:ring-atlantic-500"
          >
            <option value="ALL">All Categories</option>
            <option value="CAPABILITY">Capabilities</option>
            <option value="INDUSTRY">Industries</option>
            <option value="CONTACT">Contacts</option>
            <option value="LOCATION">Locations</option>
            <option value="CERTIFICATION">Certifications</option>
            <option value="EQUIPMENT">Equipment</option>
            <option value="SERVICE_REGION">Service Regions</option>
          </select>
        </div>
      </div>

      {/* Main Review List */}
      {canonicalFacts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-sm">
          <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            {currentStatusFilter === "HUMAN_REVIEW" ? "Human Exception Queue is Clear!" : "No Canonical Facts Found"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {currentStatusFilter === "HUMAN_REVIEW"
              ? "All low-risk canonical facts have been auto-validated. No pending exceptions require human intervention right now."
              : "No canonical facts match the selected filter criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {canonicalFacts.map((fact) => (
            <ReviewClaimCard key={fact.canonicalId} fact={fact} />
          ))}
        </div>
      )}
    </div>
  );
}
