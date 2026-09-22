"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { queueCrawlAction } from "@/lib/actions/crawler";

export function RetryCrawlButton({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleRecrawl() {
    setIsPending(true);
    try {
      const result = await queueCrawlAction(supplierId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "Failed to queue recrawl");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error queueing recrawl";
      alert(msg);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      onClick={handleRecrawl}
      disabled={isPending}
      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:opacity-50 transition"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <>
          <RefreshCw className="w-3.5 h-3.5 text-atlantic-400" />
          Recrawl
        </>
      )}
    </button>
  );
}
