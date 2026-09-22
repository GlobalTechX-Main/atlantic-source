"use client";

import { useState } from "react";
import { SupplierReportModal } from "./report-modal";
import { PlusCircle, CheckCircle2, ShieldAlert, Flag } from "lucide-react";
import { useSupplierCart } from "@/components/rfq/SupplierCart";

interface ProfileActionsProps {
  supplierCompanyId: string;
  companyName: string;
  isClaimed: boolean;
}

export function ProfileActionsBlock({ supplierCompanyId, companyName, isClaimed }: ProfileActionsProps) {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const { addSupplier, removeSupplier, isSupplierSelected } = useSupplierCart();

  const isSelected = isSupplierSelected(supplierCompanyId);

  const handleToggleCart = () => {
    if (isSelected) {
      removeSupplier(supplierCompanyId);
    } else {
      addSupplier({
        id: supplierCompanyId,
        name: companyName,
      });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Add to Sourcing Request */}
      <button
        onClick={handleToggleCart}
        className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm ${
          isSelected
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-atlantic-600 text-white hover:bg-atlantic-700"
        }`}
      >
        {isSelected ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            <span>Added to Sourcing Request</span>
          </>
        ) : (
          <>
            <PlusCircle className="w-4 h-4" />
            <span>Add to Sourcing Request</span>
          </>
        )}
      </button>

      {/* Claim Profile Action */}
      {!isClaimed && (
        <a
          href={`/admin/claims?supplierId=${supplierCompanyId}`}
          className="px-4 py-2 bg-slate-100 text-slate-800 hover:bg-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-200"
        >
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          Claim This Company
        </a>
      )}

      {/* Report Inaccurate Information */}
      <button
        onClick={() => setIsReportOpen(true)}
        className="px-3.5 py-2 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
      >
        <Flag className="w-3.5 h-3.5 text-slate-400" />
        Report
      </button>

      {/* Report Modal */}
      <SupplierReportModal
        supplierCompanyId={supplierCompanyId}
        companyName={companyName}
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
}

