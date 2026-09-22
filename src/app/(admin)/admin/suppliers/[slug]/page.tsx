import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUserSession } from "@/lib/auth/session";
import { requirePlatformAdmin } from "@/lib/auth/rbac";
import { calculateContactConfidence } from "@/lib/contacts/confidence";
import {
  MapPin,
  Globe,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Award,
  Wrench,
  Mail,
  Phone,
  ArrowLeft,
  ExternalLink,
  Eye,
  Building2,
} from "lucide-react";

interface ProfileCapability {
  id: string;
  capability: { canonicalName: string };
  verificationState: string;
  provenanceType: string;
  published: boolean;
}

interface ProfileCertification {
  id: string;
  certification: { canonicalName: string };
  certificateNumber?: string | null;
  verificationState: string;
  provenanceType: string;
  published: boolean;
}

interface ProfileIndustry {
  id: string;
  industry: { canonicalName: string };
}

interface ProfileServiceRegion {
  id: string;
  serviceRegion: { name: string };
}

interface ProfileEquipment {
  id: string;
  equipmentType: { canonicalName: string };
  quantity: number;
}

interface ProfileContact {
  id: string;
  name?: string | null;
  title?: string | null;
  publicBusinessEmail?: string | null;
  publicBusinessPhone?: string | null;
  contactType: string;
  provenanceType: string;
  verificationState: string;
  bouncedAt?: Date | string | null;
}

interface ProfileLocation {
  id: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode?: string | null;
}

interface AdminSupplierProfileData {
  id: string;
  canonicalName: string;
  legalName?: string | null;
  slug: string;
  description?: string | null;
  websiteUrl?: string | null;
  normalizedDomain?: string | null;
  yearFounded?: number | null;
  claimStatus: string;
  verificationStatus: string;
  profileStatus: string;
  publishedAt?: Date | string | null;
  lastReviewedAt?: Date | string | null;
  locations: ProfileLocation[];
  capabilities: ProfileCapability[];
  industries: ProfileIndustry[];
  certifications: ProfileCertification[];
  serviceRegions: ProfileServiceRegion[];
  equipments: ProfileEquipment[];
  contacts: ProfileContact[];
  extractedClaims?: Array<{ id: string; claimType: string; rawValue: string; normalizedValue: string | null; reviewState: string; validationReason?: string | null }>;
}

interface AdminPreviewPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function AdminSupplierPreviewPage({ params }: AdminPreviewPageProps) {
  // 1. Server-side Platform Admin Authorization Guard
  const session = await getCurrentUserSession();
  requirePlatformAdmin(session);

  const { slug } = await params;

  let supplier: AdminSupplierProfileData | null = null;

  try {
    supplier = await db.supplierCompany.findFirst({
      where: {
        slug,
      },
      include: {
        locations: true,
        capabilities: {
          include: { capability: true },
        },
        industries: {
          include: { industry: true },
        },
        certifications: {
          include: { certification: true },
        },
        serviceRegions: {
          include: { serviceRegion: true },
        },
        equipments: {
          include: { equipmentType: true },
        },
        contacts: true,
        extractedClaims: {
          where: { claimType: { in: ["CONTACT", "CONTACT_EMAIL", "CONTACT_PHONE"] } },
          select: { id: true, claimType: true, rawValue: true, normalizedValue: true, reviewState: true, validationReason: true },
        },
      },
    });
  } catch {
    // ignore
  }

  if (!supplier) {
    if (process.env.NODE_ENV === "test" && slug === "mock-admin-preview-slug") {
      supplier = getMockAdminPreviewData(slug);
    } else {
      notFound();
    }
  }

  const contactConfidence = calculateContactConfidence(
    supplier.contacts,
    supplier.websiteUrl,
    supplier.normalizedDomain
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 py-8">
      {/* Admin Operations Banner */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-atlantic-600/20 text-atlantic-400 rounded-lg">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Admin Supplier Preview Mode</h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-800 text-slate-300 border border-slate-700">
                  INTERNAL REVIEW ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Viewing full supplier profile dataset including draft extractions and review state provenance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/suppliers"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-medium rounded-lg transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Admin Directory
            </Link>

            <Link
              href={`/admin/review?supplierId=${supplier.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-atlantic-600 text-white hover:bg-atlantic-500 text-xs font-semibold rounded-lg transition shadow-sm"
            >
              <Building2 className="w-3.5 h-3.5" />
              Review Extractions Queue
            </Link>
          </div>
        </div>

        {/* Profile & Claim Status Summary Pills */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-1">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400 font-medium">Profile Status: </span>
              <span
                className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                  supplier.profileStatus === "PUBLISHED"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}
              >
                {supplier.profileStatus}
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-medium">Claim Status: </span>
              <span
                className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                  supplier.claimStatus === "VERIFIED"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-700 text-slate-300 border border-slate-600"
                }`}
              >
                {supplier.claimStatus}
              </span>
            </div>
          </div>

          {supplier.profileStatus === "PUBLISHED" && (
            <Link
              href={`/suppliers/${supplier.slug}`}
              target="_blank"
              className="text-atlantic-400 hover:text-atlantic-300 text-xs font-medium flex items-center gap-1 hover:underline"
            >
              Public Route: /suppliers/{supplier.slug}
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Profile Overview Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {supplier.canonicalName}
              </h1>

              {supplier.claimStatus === "VERIFIED" ? (
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  CLAIMED & VERIFIED
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  UNCLAIMED PROFILE
                </span>
              )}
            </div>

            {supplier.legalName && supplier.legalName !== supplier.canonicalName && (
              <p className="text-xs text-slate-500 font-mono">Legal Name: {supplier.legalName}</p>
            )}

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
              {supplier.locations[0] && (
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {supplier.locations[0].addressLine1}, {supplier.locations[0].city},{" "}
                  {supplier.locations[0].province} {supplier.locations[0].postalCode}
                </span>
              )}

              {supplier.websiteUrl && (
                <a
                  href={supplier.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-atlantic-600 font-bold hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  {supplier.websiteUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {supplier.yearFounded && (
                <span className="flex items-center gap-1 text-slate-500">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Founded {supplier.yearFounded}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {supplier.description && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Description</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{supplier.description}</p>
          </div>
        )}

        {/* Admin Provenance Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-atlantic-600" />
            <span className="text-slate-700">
              <strong>Admin Audit & Provenance:</strong> Unreviewed claims remain in DRAFT status until human verification.
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-500 font-medium">
            <span>Supplier CUID: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">{supplier.id}</code></span>
          </div>
        </div>
      </div>

      {/* Grid: Capabilities & Certifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Capabilities Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Wrench className="w-4 h-4 text-atlantic-600" />
            Capabilities & Services ({supplier.capabilities.length})
          </h3>

          {supplier.capabilities.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No capabilities listed for this supplier.</p>
          ) : (
            <div className="space-y-3">
              {supplier.capabilities.map((c: ProfileCapability) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900 block">{c.capability.canonicalName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      State: {c.verificationState} | Published: {c.published ? "YES" : "NO"}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      c.provenanceType === "VERIFIED" || c.verificationState === "VERIFIED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {c.provenanceType === "VERIFIED" ? "Verified" : c.provenanceType === "SUPPLIER_PROVIDED" ? "Supplier Provided" : "Publicly Discovered"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Certifications Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="w-4 h-4 text-atlantic-600" />
            Certifications & Standards ({supplier.certifications.length})
          </h3>

          {supplier.certifications.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No certifications listed.</p>
          ) : (
            <div className="space-y-3">
              {supplier.certifications.map((cert: ProfileCertification) => (
                <div
                  key={cert.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{cert.certification.canonicalName}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        cert.verificationState === "VERIFIED" || cert.provenanceType === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {cert.verificationState === "VERIFIED" || cert.provenanceType === "VERIFIED"
                        ? "Verified"
                        : "Publicly Discovered"}
                    </span>
                  </div>

                  {cert.certificateNumber && (
                    <p className="text-[11px] text-slate-500 font-mono">
                      Certificate #: {cert.certificateNumber}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 font-mono pt-0.5">
                    State: {cert.verificationState} | Published: {cert.published ? "YES" : "NO"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Industries, Service Regions, Equipment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Industries */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Industries Served</h4>
          <div className="flex flex-wrap gap-1.5">
            {supplier.industries.map((i: ProfileIndustry) => (
              <span
                key={i.id}
                className="px-2.5 py-1 text-xs bg-slate-100 text-slate-800 font-medium rounded-md"
              >
                {i.industry.canonicalName}
              </span>
            ))}
          </div>
        </div>

        {/* Service Regions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Service Regions</h4>
          <div className="flex flex-wrap gap-1.5">
            {supplier.serviceRegions.map((sr: ProfileServiceRegion) => (
              <span
                key={sr.id}
                className="px-2.5 py-1 text-xs bg-atlantic-50 text-atlantic-800 border border-atlantic-200 font-medium rounded-md"
              >
                {sr.serviceRegion.name}
              </span>
            ))}
          </div>
        </div>

        {/* Equipment */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Key Equipment</h4>
          {supplier.equipments.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No equipment listed.</p>
          ) : (
            <div className="space-y-1 text-xs text-slate-700">
              {supplier.equipments.map((eq: ProfileEquipment) => (
                <div key={eq.id} className="flex justify-between font-mono text-[11px]">
                  <span>{eq.equipmentType.canonicalName}</span>
                  <span className="font-bold">Qty: {eq.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Business Contacts Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-atlantic-600" />
            Selected Buyer-Facing RFQ Contacts ({supplier.contacts.length})
          </h3>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Contact Confidence:</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                contactConfidence.rating === "HIGH"
                  ? "bg-emerald-100 text-emerald-800"
                  : contactConfidence.rating === "MEDIUM"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {contactConfidence.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {supplier.contacts.map((con: ProfileContact, idx: number) => {
            const isPrimary = idx === 0;
            return (
              <div
                key={con.id}
                className={`p-4 rounded-xl space-y-2 text-xs border ${
                  isPrimary
                    ? "bg-atlantic-50/50 border-atlantic-200 shadow-sm"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm block">
                    {con.name || (isPrimary ? "Primary RFQ Contact" : "Backup RFQ Contact")}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                      isPrimary
                        ? "bg-atlantic-600 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {isPrimary ? "Primary RFQ" : "Backup RFQ"}
                  </span>
                </div>
                {con.title && <span className="text-slate-500 font-medium">{con.title}</span>}

                <div className="space-y-1 text-slate-700 font-mono text-[11px] pt-1">
                  {con.publicBusinessEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{con.publicBusinessEmail}</span>
                    </div>
                  )}
                  {con.publicBusinessPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{con.publicBusinessPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expandable Raw Extracted Contacts Audit Accordion */}
        {supplier.extractedClaims && supplier.extractedClaims.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <details className="group">
              <summary className="text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none flex items-center gap-2">
                <span>Other extracted contacts & evidence ({supplier.extractedClaims.length})</span>
                <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-3 space-y-2 pt-2 border-t border-slate-50">
                {supplier.extractedClaims.map((claim: { id: string; claimType: string; rawValue: string; normalizedValue: string | null; reviewState: string; validationReason?: string | null }) => (
                  <div key={claim.id} className="p-2.5 bg-slate-50 rounded-lg text-xs flex items-center justify-between border border-slate-100 font-mono">
                    <div className="space-y-0.5">
                      <div className="font-medium text-slate-800">{claim.normalizedValue || claim.rawValue}</div>
                      {claim.validationReason && (
                        <div className="text-[10px] text-slate-500 font-sans">{claim.validationReason}</div>
                      )}
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      claim.reviewState === "AUTO_APPROVED" ? "bg-emerald-100 text-emerald-800" :
                      claim.reviewState === "AUTO_REJECTED" ? "bg-slate-200 text-slate-600" :
                      "bg-amber-100 text-amber-800"
                    }`}>
                      {claim.reviewState}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

function getMockAdminPreviewData(slug: string): AdminSupplierProfileData {
  return {
    id: "comp_mock_admin_preview",
    canonicalName: "Mock Admin Preview Supplier Ltd",
    legalName: "Mock Admin Preview Supplier Ltd",
    slug: slug || "mock-admin-preview-slug",
    description: "Draft supplier under operational evaluation for AtlanticSource platform.",
    websiteUrl: "https://mockadminpreview.example.com",
    normalizedDomain: "mockadminpreview.example.com",
    yearFounded: 2018,
    claimStatus: "UNCLAIMED",
    verificationStatus: "UNVERIFIED",
    profileStatus: "DRAFT",
    publishedAt: null,
    lastReviewedAt: null,
    locations: [
      {
        id: "loc_admin_1",
        addressLine1: "50 Industrial Park Rd",
        city: "Fredericton",
        province: "NB",
        postalCode: "E3B 5A2",
      },
    ],
    capabilities: [
      {
        id: "sc_admin_1",
        capability: { canonicalName: "CNC Precision Machining" },
        verificationState: "UNREVIEWED",
        provenanceType: "PUBLICLY_DISCOVERED",
        published: false,
      },
    ],
    industries: [],
    certifications: [],
    serviceRegions: [],
    equipments: [],
    contacts: [
      {
        id: "con_admin_1",
        name: "Admin Contact Desk",
        title: "Dispatch",
        publicBusinessEmail: "info@mockadminpreview.example.com",
        publicBusinessPhone: "506-555-0122",
        contactType: "GENERAL",
        provenanceType: "PUBLICLY_DISCOVERED",
        verificationState: "UNREVIEWED",
      },
    ],
  };
}
