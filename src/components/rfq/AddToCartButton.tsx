"use client";

import React from "react";
import { PlusCircle, CheckCircle2 } from "lucide-react";
import { useSupplierCart } from "./SupplierCart";

interface AddToCartButtonProps {
  supplierCompanyId: string;
  companyName: string;
  location?: string;
  compact?: boolean;
}

export function AddToCartButton({
  supplierCompanyId,
  companyName,
  location,
  compact = false,
}: AddToCartButtonProps) {
  const { addSupplier, removeSupplier, isSupplierSelected } = useSupplierCart();
  const isSelected = isSupplierSelected(supplierCompanyId);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSelected) {
      removeSupplier(supplierCompanyId);
    } else {
      addSupplier({
        id: supplierCompanyId,
        name: companyName,
        location,
      });
    }
  };

  return (
    <button
      onClick={handleToggle}
      type="button"
      className={`font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      } ${
        isSelected
          ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
          : "bg-atlantic-50 text-atlantic-700 border border-atlantic-200 hover:bg-atlantic-100"
      }`}
    >
      {isSelected ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>In Sourcing Request</span>
        </>
      ) : (
        <>
          <PlusCircle className="w-3.5 h-3.5 text-atlantic-600" />
          <span>+ Add to Request</span>
        </>
      )}
    </button>
  );
}
