"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ClipboardList } from "lucide-react";
import { Logo } from "./Logo";
import { useSupplierCart } from "@/components/rfq/SupplierCart";

export const NAV_LINKS = [
  { href: "/suppliers", label: "Find suppliers" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#for-suppliers", label: "For suppliers" },
  { href: "/data-sources", label: "How we check data" },
];

function isActive(pathname: string, href: string): boolean {
  if (href.startsWith("/#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const { selectedSuppliers } = useSupplierCart();
  const count = selectedSuppliers.length;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden md:flex items-center gap-1 text-sm font-medium">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(pathname, l.href) ? "page" : undefined}
              className={`px-3 py-2 rounded-lg transition ${
                isActive(pathname, l.href) ? "text-atlantic-700 bg-atlantic-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/rfq/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-atlantic-600 text-white text-sm font-bold hover:bg-atlantic-700 transition shadow-sm"
          >
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Request quotes</span>
            {count > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-white text-atlantic-700 text-[11px] font-bold flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Main" className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
