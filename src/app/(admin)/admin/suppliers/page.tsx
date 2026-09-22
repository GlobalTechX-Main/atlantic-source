import Link from "next/link";
import { Upload } from "lucide-react";
import { db } from "@/lib/db";
import { ManualSupplierForm } from "./ManualSupplierForm";
import { SuppliersTable } from "./SuppliersTable";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  let suppliers: Array<{
    id: string;
    canonicalName: string;
    slug: string;
    normalizedDomain: string | null;
    websiteUrl: string | null;
    claimStatus: string;
    profileStatus: string;
    locations: { city: string; province: string }[];
  }> = [];

  try {
    if (process.env.NODE_ENV !== "test") {
      suppliers = await db.supplierCompany.findMany({
        include: {
          locations: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }
  } catch (err) {
    console.error("Failed to load suppliers for admin directory:", err);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supplier Ingestion & Directory</h1>
          <p className="text-sm text-slate-500">Create suppliers manually, batch import CSV files, and queue crawl jobs.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/suppliers/import"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            CSV Import Wizard
          </Link>
        </div>
      </div>

      {/* Manual Creation Form */}
      <ManualSupplierForm />

      {/* Real Ingested Directory Table */}
      <SuppliersTable suppliers={suppliers} />
    </div>
  );
}
