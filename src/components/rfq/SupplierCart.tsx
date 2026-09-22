"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";

export interface SelectedSupplier {
  id: string;
  name: string;
  location?: string;
}

interface CartContextType {
  selectedSuppliers: SelectedSupplier[];
  addSupplier: (supplier: SelectedSupplier) => void;
  removeSupplier: (id: string) => void;
  clearCart: () => void;
  isSupplierSelected: (id: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function SupplierCartProvider({ children }: { children: React.ReactNode }) {
  const [selectedSuppliers, setSelectedSuppliers] = useState<SelectedSupplier[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("atlantic_source_rfq_cart");
    if (saved) {
      try {
        setSelectedSuppliers(JSON.parse(saved));
      } catch {
        // ignore parse error
      }
    }
  }, []);

  const saveCart = (items: SelectedSupplier[]) => {
    setSelectedSuppliers(items);
    localStorage.setItem("atlantic_source_rfq_cart", JSON.stringify(items));
  };

  const addSupplier = (supplier: SelectedSupplier) => {
    if (selectedSuppliers.some((s) => s.id === supplier.id)) return;
    if (selectedSuppliers.length >= 20) {
      alert("Maximum 20 suppliers can be added per sourcing request.");
      return;
    }
    saveCart([...selectedSuppliers, supplier]);
  };

  const removeSupplier = (id: string) => {
    saveCart(selectedSuppliers.filter((s) => s.id !== id));
  };

  const clearCart = () => {
    saveCart([]);
  };

  const isSupplierSelected = (id: string) => {
    return selectedSuppliers.some((s) => s.id === id);
  };

  return (
    <CartContext.Provider
      value={{
        selectedSuppliers,
        addSupplier,
        removeSupplier,
        clearCart,
        isSupplierSelected,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useSupplierCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useSupplierCart must be used within SupplierCartProvider");
  }
  return context;
}

export function SupplierCartDrawer() {
  const { selectedSuppliers, removeSupplier, clearCart } = useSupplierCart();
  const [isOpen, setIsOpen] = useState(false);

  if (selectedSuppliers.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-3 rounded-full shadow-lg font-medium text-sm flex items-center gap-2 transition-all transform hover:scale-105"
        >
          <span>Sourcing Request Cart</span>
          <span className="bg-sky-900 text-sky-100 rounded-full px-2 py-0.5 text-xs font-bold">
            {selectedSuppliers.length}
          </span>
        </button>
      ) : (
        <div className="bg-slate-900 border border-slate-800 text-white rounded-xl shadow-2xl p-5 w-80 max-h-96 flex flex-col transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
              <span>Sourcing Cart</span>
              <span className="text-xs text-sky-400 font-mono">
                ({selectedSuppliers.length}/20)
              </span>
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1"
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto flex-1 my-3 space-y-2 pr-1">
            {selectedSuppliers.map((sup) => (
              <div
                key={sup.id}
                className="flex items-center justify-between text-xs bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50"
              >
                <div>
                  <div className="font-medium text-slate-200">{sup.name}</div>
                  {sup.location && (
                    <div className="text-slate-400 text-[10px]">{sup.location}</div>
                  )}
                </div>
                <button
                  onClick={() => removeSupplier(sup.id)}
                  className="text-slate-400 hover:text-rose-400 text-xs px-1.5 py-0.5"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
            <Link
              href="/rfq/new"
              onClick={() => setIsOpen(false)}
              className="bg-sky-600 hover:bg-sky-500 text-white text-center py-2.5 rounded-lg text-xs font-semibold shadow transition-colors"
            >
              Create Sourcing Request ({selectedSuppliers.length})
            </Link>
            <button
              onClick={clearCart}
              className="text-slate-400 hover:text-slate-200 text-center py-1 text-[11px]"
            >
              Clear Cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
