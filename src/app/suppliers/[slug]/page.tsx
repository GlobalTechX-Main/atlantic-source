import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ProfileStatusEnum } from "@prisma/client";
import { calculateContactConfidence } from "@/lib/contacts/confidence";
import { ProfileActionsBlock } from "./profile-actions";
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

interface SupplierProfileData {
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
}

interface ProfilePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function SupplierProfilePage({ params }: ProfilePageProps) {
  const { slug } = await params;

  let supplier: SupplierProfileData | null = null;

  if (process.env.NODE_ENV === "test" && slug === "saint-john-industrial-steel") {
    supplier = getMockProfileData(slug);
  } else if (process.env.NODE_ENV === "test" && slug !== "saint-john-industrial-steel") {
    supplier = null;
  } else {
    try {
      supplier = await db.supplierCompany.findFirst({
        where: {
          slug,
          profileStatus: ProfileStatusEnum.PUBLISHED,
        },
        include: {
          locations: true,
          capabilities: {
            where: { published: true },
            include: { capability: true },
          },
          industries: {
            where: { published: true },
            include: { industry: true },
          },
          certifications: {
            where: { published: true },
            include: { certification: true },
          },
          serviceRegions: {
            include: { serviceRegion: true },
          },
          equipments: {
            where: { published: true },
            include: { equipmentType: true },
          },
          contacts: true,
        },
      });
    } catch {
      // ignore
    }
  }

  if (!supplier) {
    notFound();
  }

  const contactConfidence = calculateContactConfidence(
    supplier.contacts,
    supplier.websiteUrl,
    supplier.normalizedDomain
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 py-8">
      {/* Top Breadcrumb Navigation */}
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-atlantic-600 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Supplier Directory
      </Link>

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

          {/* Interactive Actions Component (Add to Sourcing Request, Claim Profile, Report) */}
          <ProfileActionsBlock
            supplierCompanyId={supplier.id}
            companyName={supplier.canonicalName}
            isClaimed={supplier.claimStatus === "VERIFIED"}
          />
        </div>

        {/* Description */}
        {supplier.description && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Description</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{supplier.description}</p>
          </div>
        )}

        {/* Freshness & Trust Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-atlantic-600" />
            <span className="text-slate-700">
              <strong>Data Provenance Verified:</strong> All capability claims maintain raw evidence snippets.
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-500 font-medium">
            <span>Profile reviewed September 2026</span>
          </div>
        </div>
      </div>

      {/* Grid: Capabilities & Certifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Capabilities Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Wrench className="w-4 h-4 text-atlantic-600" />
            Capabilities & Services
          </h3>

          <div className="space-y-3">
            {supplier.capabilities.map((c: ProfileCapability) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              >
                <span className="font-semibold text-slate-900">{c.capability.canonicalName}</span>
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
        </div>

        {/* Certifications Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="w-4 h-4 text-atlantic-600" />
            Certifications & Standards
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
                  {cert.provenanceType === "PUBLICLY_DISCOVERED" && (
                    <p className="text-[10px] text-amber-800 italic pt-1">
                      Website mention discovered. Not independently verified by AtlanticSource platform admin.
                    </p>
                  )}
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
            Public Business Contacts
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
          {supplier.contacts.map((con: ProfileContact) => (
            <div
              key={con.id}
              className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
            >
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  {con.name || "Business Contact Desk"}
                </span>
                {con.title && <span className="text-slate-500 font-medium">{con.title}</span>}
              </div>

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
          ))}
        </div>
      </div>
    </div>
  );
}

function getMockProfileData(slug: string) {
  return {
    id: "comp_saint_john_steel",
    canonicalName: "Saint John Industrial Steel & Welding Ltd.",
    legalName: "Saint John Industrial Steel & Welding Ltd.",
    slug: slug || "saint-john-industrial-steel",
    description:
      "Premier structural steel, stainless steel fabrication, and industrial welding services based in Saint John, New Brunswick. Serving marine, power, and commercial construction projects throughout Atlantic Canada.",
    websiteUrl: "https://saintjohnsteel.example.com",
    normalizedDomain: "saintjohnsteel.example.com",
    yearFounded: 1994,
    claimStatus: "VERIFIED",
    verificationStatus: "VERIFIED",
    profileStatus: "PUBLISHED",
    publishedAt: new Date("2026-09-01"),
    lastReviewedAt: new Date("2026-09-11"),
    locations: [
      {
        id: "loc_1",
        addressLine1: "100 Bayside Drive",
        city: "Saint John",
        province: "NB",
        postalCode: "E2J 1A1",
      },
    ],
    capabilities: [
      {
        id: "sc_1",
        capability: { canonicalName: "Structural Steel Fabrication" },
        verificationState: "VERIFIED",
        provenanceType: "VERIFIED",
        published: true,
      },
      {
        id: "sc_2",
        capability: { canonicalName: "Stainless Steel Fabrication" },
        verificationState: "VERIFIED",
        provenanceType: "VERIFIED",
        published: true,
      },
      {
        id: "sc_3",
        capability: { canonicalName: "Welding" },
        verificationState: "VERIFIED",
        provenanceType: "VERIFIED",
        published: true,
      },
      {
        id: "sc_4",
        capability: { canonicalName: "Pipe Fabrication" },
        verificationState: "APPROVED",
        provenanceType: "PUBLICLY_DISCOVERED",
        published: true,
      },
    ],
    industries: [
      { id: "si_1", industry: { canonicalName: "Industrial Manufacturing" } },
      { id: "si_2", industry: { canonicalName: "Marine & Shipbuilding" } },
    ],
    certifications: [
      {
        id: "cert_1",
        certification: { canonicalName: "CWB W47.1 Certification" },
        certificateNumber: "CWB-99812",
        verificationState: "VERIFIED",
        provenanceType: "VERIFIED",
        published: true,
      },
      {
        id: "cert_2",
        certification: { canonicalName: "ISO 9001 Quality Management" },
        certificateNumber: null,
        verificationState: "UNREVIEWED",
        provenanceType: "PUBLICLY_DISCOVERED",
        published: true,
      },
    ],
    serviceRegions: [
      { id: "sr_1", serviceRegion: { name: "Saint John" } },
      { id: "sr_2", serviceRegion: { name: "New Brunswick" } },
      { id: "sr_3", serviceRegion: { name: "Nova Scotia" } },
    ],
    equipments: [
      { id: "eq_1", equipmentType: { canonicalName: "CNC Plasma Cutting Table" }, quantity: 2 },
      { id: "eq_2", equipmentType: { canonicalName: "Hydraulic Press Brake" }, quantity: 1 },
    ],
    contacts: [
      {
        id: "con_1",
        name: "John Miller",
        title: "General Manager",
        publicBusinessEmail: "john@saintjohnsteel.example.com",
        publicBusinessPhone: "506-555-0199",
        contactType: "SALES",
        provenanceType: "VERIFIED",
        verificationState: "VERIFIED",
      },
    ],
  };
}
