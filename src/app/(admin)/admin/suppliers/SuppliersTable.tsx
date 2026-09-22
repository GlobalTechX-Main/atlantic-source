"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Globe, Loader2, CheckCircle2, AlertCircle, Check, Trash2 } from "lucide-react";
import { queueCrawlAction } from "@/lib/actions/crawler";
import {
  publishSupplierProfileAction,
  unpublishSupplierProfileAction,
  publishAllSupplierProfilesAction,
} from "@/lib/actions/review";

export interface SupplierItem {
  id: string;
  canonicalName: string;
  slug: string;
  normalizedDomain: string | null;
  websiteUrl: string | null;
  claimStatus: string;
  profileStatus: string;
  locations: { city: string; province: string }[];
}

function QueueCrawlButton({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleQueueCrawl() {
    setIsPending(true);
    setStatusMessage(null);

    try {
      const result = await queueCrawlAction(supplierId);
      if (!result.success) {
        setStatusMessage({ type: "error", message: result.error || "Failed to queue crawl job" });
      } else {
        setStatusMessage({ type: "success", message: "Crawl job QUEUED! Redirecting..." });
        router.refresh();
        setTimeout(() => {
          router.push("/admin/crawler");
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error queueing crawl";
      setStatusMessage({ type: "error", message: msg });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleQueueCrawl}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
      >
        {isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Queueing...
          </>
        ) : (
          <>
            <Globe className="w-3.5 h-3.5 text-atlantic-400" />
            Queue Crawl
          </>
        )}
      </button>

      {statusMessage && (
        <span
          className={`text-[11px] flex items-center gap-1 font-medium ${
            statusMessage.type === "success" ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
          )}
          {statusMessage.message}
        </span>
      )}
    </div>
  );
}

function PublishProfileButton({ supplierId, profileStatus }: { supplierId: string; profileStatus: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isPublished, setIsPublished] = useState(profileStatus === "PUBLISHED");

  async function handlePublish() {
    if (!confirm("Are you sure you want to explicitly publish this supplier profile to the public directory?")) {
      return;
    }
    setIsPending(true);
    try {
      const res = await publishSupplierProfileAction(supplierId);
      if (res.success) {
        setIsPublished(true);
        router.refresh();
      } else {
        alert("error" in res ? res.error : "Failed to publish profile");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error publishing profile");
    } finally {
      setIsPending(false);
    }
  }

  if (isPublished) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
        <Check className="w-3 h-3 text-emerald-600" />
        Published
      </span>
    );
  }

  return (
    <button
      onClick={handlePublish}
      disabled={isPending}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
    >
      {isPending ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Publishing...
        </>
      ) : (
        "Publish Profile"
      )}
    </button>
  );
}

function RemoveProfileButton({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleRemove() {
    if (!confirm("Remove this supplier from the public directory? This will not delete its data.")) {
      return;
    }
    setIsPending(true);
    try {
      const res = await unpublishSupplierProfileAction(supplierId);
      if (res.success) {
        router.refresh();
      } else {
        alert("error" in res ? res.error : "Failed to remove profile");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error removing profile");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={isPending}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 text-white text-xs font-medium rounded hover:bg-rose-700 disabled:opacity-50 transition shadow-sm"
    >
      {isPending ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Removing...
        </>
      ) : (
        <>
          <Trash2 className="w-3 h-3 text-white" />
          Remove Profile
        </>
      )}
    </button>
  );
}

function PublishAllProfilesButton({ suppliers }: { suppliers: SupplierItem[] }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const draftCount = suppliers.filter((s) => s.profileStatus !== "PUBLISHED").length;

  async function handlePublishAll() {
    if (!confirm(`Publish ${draftCount} supplier profiles to the public directory?`)) {
      return;
    }
    setIsPending(true);
    setResultMessage(null);

    try {
      const res = await publishAllSupplierProfilesAction();
      if (res.success) {
        setResultMessage(`Published ${res.publishedCount} supplier profiles (skipped ${res.skippedCount} already published)`);
        router.refresh();
      } else {
        alert(res.error || "Failed to bulk publish supplier profiles");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error bulk publishing profiles");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {resultMessage && (
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
          {resultMessage}
        </span>
      )}
      <button
        onClick={handlePublishAll}
        disabled={isPending || draftCount === 0}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
      >
        {isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Publishing All...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
            Publish All Profiles ({draftCount})
          </>
        )}
      </button>
    </div>
  );
}

export function SuppliersTable({ suppliers }: { suppliers: SupplierItem[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500" />
          Ingested Suppliers Directory ({suppliers.length})
        </h3>

        <PublishAllProfilesButton suppliers={suppliers} />
      </div>

      {suppliers.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm">
          No suppliers found in directory. Use the form above to add a supplier manually.
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 font-semibold">Supplier Name</th>
              <th className="px-6 py-3 font-semibold">Domain</th>
              <th className="px-6 py-3 font-semibold">City</th>
              <th className="px-6 py-3 font-semibold">Claim Status</th>
              <th className="px-6 py-3 font-semibold">Profile Status</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {suppliers.map((sup) => {
              const primaryCity = sup.locations[0]
                ? `${sup.locations[0].city}, ${sup.locations[0].province}`
                : "New Brunswick";

              const profileHref =
                sup.profileStatus === "PUBLISHED" ? `/suppliers/${sup.slug}` : `/admin/suppliers/${sup.slug}`;

              return (
                <tr key={sup.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <Link href={profileHref} className="hover:underline hover:text-atlantic-600">
                      {sup.canonicalName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                    {sup.normalizedDomain || sup.websiteUrl || "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{primaryCity}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        sup.claimStatus === "VERIFIED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {sup.claimStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        sup.profileStatus === "PUBLISHED"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {sup.profileStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {sup.profileStatus === "PUBLISHED" ? (
                        <RemoveProfileButton supplierId={sup.id} />
                      ) : (
                        <PublishProfileButton supplierId={sup.id} profileStatus={sup.profileStatus} />
                      )}
                      <QueueCrawlButton supplierId={sup.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
