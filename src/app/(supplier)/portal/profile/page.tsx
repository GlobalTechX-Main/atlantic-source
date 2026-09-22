"use client";

import { useState } from "react";
import { updateSupplierProfile, addSupplierCapability, submitSupplierCertification } from "@/lib/supplier/portal";
import { UserSession } from "@/lib/auth/session";
import { UserRoleEnum } from "@prisma/client";
import { Wrench, Award, CheckCircle2, AlertCircle, Plus, Save } from "lucide-react";

export default function SupplierProfileManagementPage() {
  const [description, setDescription] = useState(
    "Premier structural steel, stainless steel fabrication, and industrial welding services based in Saint John, New Brunswick."
  );
  const [websiteUrl, setWebsiteUrl] = useState("https://saintjohnsteel.example.com");
  const [yearFounded, setYearFounded] = useState(1994);

  const [selectedCapability, setSelectedCapability] = useState("pipe-fabrication");
  const [selectedCert, setSelectedCert] = useState("cwb-w47-1");
  const [certNumber, setCertNumber] = useState("CWB-99812");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mockUserSession: { user: UserSession } = {
    user: {
      id: "usr_supp_admin_1",
      email: "john@saintjohnsteel.example.com",
      isPlatformAdmin: false,
      supplierMemberships: [{ supplierCompanyId: "comp_saint_john_steel", role: UserRoleEnum.SUPPLIER_ADMIN }],
      buyerMemberships: [],
    },
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      await updateSupplierProfile(mockUserSession.user, "comp_saint_john_steel", {
        description,
        websiteUrl,
        yearFounded: Number(yearFounded),
      });

      setIsSaving(false);
      setFeedback({
        type: "success",
        text: "Profile updated successfully! Stored as SUPPLIER_PROVIDED in UNREVIEWED state.",
      });
    } catch (err: unknown) {
      setIsSaving(false);
      setFeedback({ type: "error", text: (err as Error).message || "Failed to update profile." });
    }
  };

  const handleAddCapability = async () => {
    setFeedback(null);
    try {
      await addSupplierCapability(mockUserSession.user, "comp_saint_john_steel", {
        capabilityId: selectedCapability,
      });

      setFeedback({
        type: "success",
        text: `Capability added! Labeled as SUPPLIER_PROVIDED in UNREVIEWED state. Crawler evidence preserved.`,
      });
    } catch (err: unknown) {
      setFeedback({ type: "error", text: (err as Error).message || "Failed to add capability." });
    }
  };

  const handleSubmitCert = async () => {
    setFeedback(null);
    try {
      await submitSupplierCertification(mockUserSession.user, "comp_saint_john_steel", {
        certificationId: selectedCert,
        certificateNumber: certNumber,
      });

      setFeedback({
        type: "success",
        text: `Certification submitted! Stored as SUPPLIER_PROVIDED in UNREVIEWED state. Admin verification pending.`,
      });
    } catch (err: unknown) {
      setFeedback({ type: "error", text: (err as Error).message || "Failed to submit certification." });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manage Supplier Profile & Certifications</h1>
        <p className="text-xs text-slate-500 mt-1">
          Update company description, capabilities, and submit certifications. All supplier edits are stored as <strong>SUPPLIER_PROVIDED</strong>.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Profile Details Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-atlantic-600" />
          Company Profile Details
        </h3>

        <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Website URL</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Year Founded</label>
              <input
                type="number"
                value={yearFounded}
                onChange={(e) => setYearFounded(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 bg-atlantic-600 text-white font-bold rounded-lg hover:bg-atlantic-700 transition flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Profile Details"}
          </button>
        </form>
      </div>

      {/* Add Capabilities */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-atlantic-600" />
          Add Supplier Capabilities
        </h3>

        <div className="flex items-center gap-3 text-xs">
          <select
            value={selectedCapability}
            onChange={(e) => setSelectedCapability(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
          >
            <option value="pipe-fabrication">Pipe Fabrication</option>
            <option value="equipment-maintenance">Equipment Maintenance</option>
            <option value="instrumentation">Instrumentation</option>
            <option value="industrial-cleaning">Industrial Cleaning</option>
          </select>

          <button
            onClick={handleAddCapability}
            className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Capability
          </button>
        </div>
      </div>

      {/* Submit Certifications */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-atlantic-600" />
          Submit Certification for Admin Verification
        </h3>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Certification Type</label>
            <select
              value={selectedCert}
              onChange={(e) => setSelectedCert(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
            >
              <option value="cwb-w47-1">CWB W47.1 Certification</option>
              <option value="iso-9001">ISO 9001 Quality Management</option>
              <option value="cor-safety">COR Safety Certification</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Certificate Number</label>
            <input
              type="text"
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              placeholder="e.g. CWB-99812"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>
        </div>

        <button
          onClick={handleSubmitCert}
          className="px-5 py-2 bg-atlantic-600 text-white font-bold text-xs rounded-lg hover:bg-atlantic-700 transition flex items-center gap-1.5 shadow-sm"
        >
          <Award className="w-4 h-4" />
          Submit Certification (Supplier Provided)
        </button>
      </div>
    </div>
  );
}
