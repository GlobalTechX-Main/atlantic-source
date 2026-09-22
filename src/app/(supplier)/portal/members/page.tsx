"use client";

import { useState } from "react";
import { manageSupplierMembers } from "@/lib/supplier/portal";
import { Users, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { UserRoleEnum } from "@prisma/client";
import { UserSession } from "@/lib/auth/session";

export default function SupplierMembersPage() {
  const [targetEmail, setTargetEmail] = useState("");
  const [role, setRole] = useState<UserRoleEnum>(UserRoleEnum.SUPPLIER_MEMBER);

  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const mockUserSession: { user: UserSession } = {
    user: {
      id: "usr_supp_admin_1",
      email: "john@saintjohnsteel.example.com",
      isPlatformAdmin: false,
      supplierMemberships: [{ supplierCompanyId: "comp_saint_john_steel", role: UserRoleEnum.SUPPLIER_ADMIN }],
      buyerMemberships: [],
    },
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    try {
      await manageSupplierMembers(
        mockUserSession.user,
        "comp_saint_john_steel",
        `usr_${Date.now()}`,
        role
      );

      setStatusMessage({
        type: "success",
        text: `Team member updated/added with role ${role}. Audit log recorded.`,
      });
      setTargetEmail("");
    } catch (err: unknown) {
      setStatusMessage({ type: "error", text: (err as Error).message || "Failed to update member." });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Supplier Team & Member Permissions</h1>
        <p className="text-xs text-slate-500 mt-1">
          Supplier Admins can invite team members and manage role permissions for this company profile.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Add Member Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-atlantic-600" />
          Add / Manage Team Member (Supplier Admin Only)
        </h3>

        <form onSubmit={handleAddMember} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">User Email Address</label>
              <input
                type="email"
                required
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="colleague@saintjohnsteel.example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRoleEnum)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                <option value={UserRoleEnum.SUPPLIER_MEMBER}>SUPPLIER_MEMBER (Edit Profile)</option>
                <option value={UserRoleEnum.SUPPLIER_ADMIN}>SUPPLIER_ADMIN (Manage Team & Profile)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2 bg-atlantic-600 text-white font-bold rounded-lg hover:bg-atlantic-700 transition shadow-sm"
          >
            Save Team Member
          </button>
        </form>
      </div>

      {/* Existing Members Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-atlantic-600" />
            Current Organization Members
          </h3>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
            <tr>
              <th className="px-6 py-3">Member Email</th>
              <th className="px-6 py-3">Assigned Role</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            <tr>
              <td className="px-6 py-4 font-bold text-slate-900">john@saintjohnsteel.example.com</td>
              <td className="px-6 py-4">
                <span className="px-2 py-0.5 rounded bg-atlantic-50 text-atlantic-800 font-bold border border-atlantic-200">
                  SUPPLIER_ADMIN
                </span>
              </td>
              <td className="px-6 py-4 text-emerald-600 font-bold">ACTIVE</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
