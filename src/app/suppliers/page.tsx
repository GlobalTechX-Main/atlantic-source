import Link from "next/link";
import { searchSuppliers } from "@/lib/search/engine";
import { Search, MapPin, Filter, ShieldCheck, CheckCircle2, Building2, ExternalLink } from "lucide-react";
import { AddToCartButton } from "@/components/rfq/AddToCartButton";

interface SuppliersPageProps {
  searchParams: Promise<{
    q?: string;
    province?: string;
    city?: string;
    capability?: string | string[];
    industry?: string | string[];
    certification?: string | string[];
    claimed?: string;
    verified?: string;
    contactConfidence?: string;
    reqCap?: string | string[];
    reqCert?: string | string[];
    certStrict?: "VERIFIED" | "ALLOW_DISCOVERED";
    page?: string;
  }>;
}

export default async function SuppliersDirectoryPage({ searchParams }: SuppliersPageProps) {
  const params = await searchParams;

  const q = params.q || "";
  const province = params.province || "";
  const city = params.city || "";

  const capabilities = Array.isArray(params.capability)
    ? params.capability
    : params.capability
    ? [params.capability]
    : [];

  const industries = Array.isArray(params.industry)
    ? params.industry
    : params.industry
    ? [params.industry]
    : [];

  const certifications = Array.isArray(params.certification)
    ? params.certification
    : params.certification
    ? [params.certification]
    : [];

  const claimedStatus = (params.claimed || "ALL") as "ALL" | "CLAIMED" | "UNCLAIMED";
  const verificationStatus = (params.verified || "ALL") as "ALL" | "VERIFIED" | "UNVERIFIED";
  const contactConfidenceFilter = (params.contactConfidence || "ALL") as "ALL" | "HIGH" | "MEDIUM" | "LOW";

  const reqCaps = Array.isArray(params.reqCap)
    ? params.reqCap
    : params.reqCap
    ? [params.reqCap]
    : [];

  const reqCerts = Array.isArray(params.reqCert)
    ? params.reqCert
    : params.reqCert
    ? [params.reqCert]
    : [];

  const certStrict = params.certStrict || "VERIFIED";
  const parsedPage = parseInt(params.page || "1", 10);
  const pageNum = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const hasStructuredCriteria = reqCaps.length > 0 || reqCerts.length > 0 || city.length > 0;

  const searchOutput = await searchSuppliers({
    q,
    province,
    city,
    capabilities,
    industries,
    certifications,
    claimedStatus,
    verificationStatus,
    contactConfidence: contactConfidenceFilter,
    matchingCriteria: hasStructuredCriteria
      ? {
          requiredCapabilityIds: reqCaps,
          requiredCertificationIds: reqCerts,
          certStrictness: certStrict,
          targetCity: city,
          targetProvince: province,
        }
      : undefined,
    page: pageNum,
    pageSize: 20,
  });

  /** Link to another results page, keeping every current filter. */
  const pageHref = (target: number): string => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) {
        if (v) qs.append(key, v);
      }
    }
    if (target > 1) qs.set("page", String(target));
    const s = qs.toString();
    return s ? `/suppliers?${s}` : "/suppliers";
  };
  const { totalPages, totalCount } = searchOutput;
  const firstShown = totalCount === 0 ? 0 : (searchOutput.page - 1) * searchOutput.pageSize + 1;
  const lastShown = Math.min(totalCount, searchOutput.page * searchOutput.pageSize);

  const availableCapabilities = [
    { name: "Structural Steel Fabrication", slug: "structural-steel-fabrication" },
    { name: "Stainless Steel Fabrication", slug: "stainless-steel-fabrication" },
    { name: "Welding", slug: "welding" },
    { name: "Machining", slug: "machining" },
    { name: "Pipe Fabrication", slug: "pipe-fabrication" },
    { name: "Electrical Contracting", slug: "electrical-contracting" },
    { name: "Mechanical/HVAC", slug: "mechanical-hvac" },
  ];

  const availableCertifications = [
    { name: "CWB W47.1 Certification", slug: "cwb-w47-1" },
    { name: "ISO 9001 Quality Management", slug: "iso-9001" },
    { name: "COR Safety Certification", slug: "cor-safety" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Atlantic Canada Supplier Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search verified suppliers across New Brunswick. Filter by capabilities, certifications, and location with source evidence provenance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-slate-100 text-slate-700 font-mono text-xs font-semibold rounded border border-slate-200">
            {searchOutput.totalCount} Suppliers Found
          </span>
        </div>
      </div>

      {/* Main Grid: Left Filters Sidebar + Right Results List */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters Form */}
        <aside className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 self-start">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-atlantic-600" />
              Structured Search Filters
            </h3>
            <Link href="/suppliers" className="text-xs text-atlantic-600 hover:underline">Reset</Link>
          </div>

          <form action="/suppliers" method="GET" className="space-y-6 text-xs">
            {/* Keyword Input */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Keyword Search</label>
              <div className="relative">
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="e.g. Steel, CWB, CNC..."
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-atlantic-600"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Geography */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Location / City</label>
              <select
                name="city"
                defaultValue={city}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none"
              >
                <option value="">All Cities (New Brunswick)</option>
                <option value="Saint John">Saint John, NB</option>
                <option value="Fredericton">Fredericton, NB</option>
                <option value="Moncton">Moncton, NB</option>
              </select>
            </div>

            {/* Capabilities Multi-select */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-700 block">Capabilities</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {availableCapabilities.map((cap) => (
                  <label key={cap.slug} className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      name="capability"
                      value={cap.slug}
                      defaultChecked={capabilities.includes(cap.slug)}
                      className="rounded border-slate-300 text-atlantic-600 focus:ring-atlantic-500"
                    />
                    <span className="truncate">{cap.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Certifications Filter */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-700 block">Certifications</label>
              <div className="space-y-1.5">
                {availableCertifications.map((cert) => (
                  <label key={cert.slug} className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      name="certification"
                      value={cert.slug}
                      defaultChecked={certifications.includes(cert.slug)}
                      className="rounded border-slate-300 text-atlantic-600 focus:ring-atlantic-500"
                    />
                    <span className="truncate">{cert.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contact Confidence Rating */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Contact Confidence</label>
              <select
                name="contactConfidence"
                defaultValue={contactConfidenceFilter}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                <option value="ALL">All Confidence Ratings</option>
                <option value="HIGH">High Confidence Only</option>
                <option value="MEDIUM">Medium Confidence & Above</option>
              </select>
            </div>

            {/* Deterministic Match Criteria Toggle */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <span className="font-bold text-atlantic-900 block flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-atlantic-600" />
                Structured MatchEngine Rules
              </span>

              <div className="space-y-2 bg-atlantic-50/50 p-3 rounded-xl border border-atlantic-100">
                <label className="font-semibold text-slate-700 block text-[11px]">Require Capability:</label>
                <select name="reqCap" defaultValue={reqCaps[0] || ""} className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white">
                  <option value="">None Required</option>
                  {availableCapabilities.map((cap) => (
                    <option key={cap.slug} value={cap.slug}>{cap.name}</option>
                  ))}
                </select>

                <label className="font-semibold text-slate-700 block text-[11px] pt-1">Require Certification:</label>
                <select name="reqCert" defaultValue={reqCerts[0] || ""} className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white">
                  <option value="">None Required</option>
                  {availableCertifications.map((cert) => (
                    <option key={cert.slug} value={cert.slug}>{cert.name}</option>
                  ))}
                </select>

                <label className="font-semibold text-slate-700 block text-[11px] pt-1">Cert Strictness Mode:</label>
                <select name="certStrict" defaultValue={certStrict} className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white">
                  <option value="VERIFIED">VERIFIED ONLY (Strict)</option>
                  <option value="ALLOW_DISCOVERED">Allow Discovered Evidence</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-atlantic-600 text-white font-bold text-xs rounded-lg hover:bg-atlantic-700 transition shadow-sm"
            >
              Apply Filters & Calculate Matches
            </button>
          </form>
        </aside>

        {/* Results List Column */}
        <main className="lg:col-span-3 space-y-6">
          {searchOutput.hasActiveStructuredMatching && (
            <div className="bg-atlantic-50 border border-atlantic-200 rounded-xl p-4 text-xs text-atlantic-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-atlantic-700" />
                <span>
                  <strong>Deterministic MatchEngine Active:</strong> Displaying match breakdown scores for structured buyer criteria.
                </span>
              </div>
              <span className="font-mono text-[11px] text-atlantic-700">Strict Cert Mode: {certStrict}</span>
            </div>
          )}

          {searchOutput.suppliers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">No Published Suppliers Matched</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No published supplier profiles match the selected criteria. Try adjusting your keyword query, region, or certification filters.
              </p>
              <Link href="/suppliers" className="inline-block px-4 py-2 bg-slate-100 text-slate-700 font-medium text-xs rounded-lg hover:bg-slate-200 transition">
                Clear Filters
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {searchOutput.suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 shadow-sm space-y-4 transition"
                >
                  {/* Card Top Line */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/suppliers/${supplier.slug}`}
                          className="text-xl font-bold text-slate-900 hover:text-atlantic-600 transition"
                        >
                          {supplier.canonicalName}
                        </Link>
                        {supplier.claimStatus === "VERIFIED" ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            CLAIMED & VERIFIED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200">
                            UNCLAIMED PROFILE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {supplier.locations[0] ? `${supplier.locations[0].city}, ${supplier.locations[0].province}` : "New Brunswick"}
                        </span>
                        {supplier.websiteUrl && (
                          <a
                            href={supplier.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-atlantic-600 hover:underline"
                          >
                            Website
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Match Score Display (ONLY shown when structured matching active) */}
                    {searchOutput.hasActiveStructuredMatching && supplier.matchResult && (
                      <div className="text-right sm:self-center flex-shrink-0">
                        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-900 text-white font-mono font-bold text-lg">
                          {supplier.matchResult.scorePercentage}% Match
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {supplier.matchResult.isEligible ? "✓ Eligible" : "⚠ Ineligible (Requirements missing)"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {supplier.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {supplier.description}
                    </p>
                  )}

                  {/* Capabilities & Certifications Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Capabilities:</span>
                    {supplier.capabilities.slice(0, 4).map((cap) => (
                      <span
                        key={cap.id}
                        className="px-2.5 py-1 text-xs bg-slate-50 text-slate-700 font-medium rounded-md border border-slate-200"
                      >
                        {cap.canonicalName}
                      </span>
                    ))}

                    {supplier.certifications.length > 0 && (
                      <>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase ml-2">Certs:</span>
                        {supplier.certifications.map((cert) => (
                          <span
                            key={cert.id}
                            className={`px-2 py-0.5 text-xs font-semibold rounded border flex items-center gap-1 ${
                              cert.verificationState === "VERIFIED" || cert.provenanceType === "VERIFIED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {cert.canonicalName}
                          </span>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Match Breakdown Items (When Active) */}
                  {searchOutput.hasActiveStructuredMatching && supplier.matchResult && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 font-mono">
                      <span className="font-sans font-bold text-slate-700 text-[11px] uppercase tracking-wider block">
                        Match Engine Rule Breakdown:
                      </span>
                      {supplier.matchResult.breakdown.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-slate-800">
                          <span className={item.status === "SATISFIED" ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                            {item.label}
                          </span>
                          {item.note && <span className="text-slate-500 text-[10px]">({item.note})</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bottom Footer Info */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-4">
                      {/* Contact Confidence Rating */}
                      <span className="flex items-center gap-1 font-medium">
                        Confidence:
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            supplier.contactConfidence.rating === "HIGH"
                              ? "bg-emerald-100 text-emerald-800"
                              : supplier.contactConfidence.rating === "MEDIUM"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {supplier.contactConfidence.label}
                        </span>
                      </span>

                      <span>Profile reviewed September 2026</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <AddToCartButton
                        supplierCompanyId={supplier.id}
                        companyName={supplier.canonicalName}
                        location={supplier.locations[0] ? `${supplier.locations[0].city}, ${supplier.locations[0].province}` : "Atlantic Canada"}
                      />
                      <Link
                        href={`/suppliers/${supplier.slug}`}
                        className="text-atlantic-600 font-bold hover:underline flex items-center gap-1"
                      >
                        View Full Profile & Provenance →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">
                Showing {firstShown}–{lastShown} of {totalCount}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {searchOutput.page > 1 ? (
                  <Link href={pageHref(searchOutput.page - 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
                    ← Previous
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-300">← Previous</span>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) =>
                  n === searchOutput.page ? (
                    <span key={n} aria-current="page" className="px-3 py-1.5 rounded-lg bg-atlantic-600 text-white font-bold">
                      {n}
                    </span>
                  ) : (
                    <Link key={n} href={pageHref(n)} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
                      {n}
                    </Link>
                  )
                )}
                {searchOutput.page < totalPages ? (
                  <Link href={pageHref(searchOutput.page + 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
                    Next →
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-300">Next →</span>
                )}
              </div>
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}
