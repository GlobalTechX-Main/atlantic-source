"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Check, Plus, X, ShieldCheck, Phone } from "lucide-react";
import { SAMPLE_SUPPLIERS, PREVIEW_CITIES, SampleSupplier } from "./sampleSuppliers";

const POPULAR = ["Welding", "Machining", "NDT Inspection", "Structural Steel", "Fabrication"];
const CAPABILITY_FILTERS = ["Welding", "Fabrication", "Machining", "Structural Steel", "NDT Inspection", "Pipe Fabrication"];
const CERT_FILTERS = ["CWB W47.1", "ISO 9001", "COR", "ASME VIII"];

interface HeroSearchProps {
  supplierCount: number | null;
  cityCount: number;
}

function matches(s: SampleSupplier, q: string): boolean {
  const hay = [s.name, s.summary, ...s.capabilities, ...s.certifications, ...s.services].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

function checked(days: number): string {
  if (days <= 1) return "Checked yesterday";
  if (days < 7) return `Checked ${days} days ago`;
  const weeks = Math.round(days / 7);
  return `Checked ${weeks} week${weeks > 1 ? "s" : ""} ago`;
}

export function HeroSearch({ supplierCount, cityCount }: HeroSearchProps) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [caps, setCaps] = useState<string[]>([]);
  const [certs, setCerts] = useState<string[]>([]);
  const [highOnly, setHighOnly] = useState(false);
  const [tray, setTray] = useState<string[]>([]);

  const results = useMemo(
    () =>
      SAMPLE_SUPPLIERS.filter(
        (s) =>
          matches(s, q) &&
          (!city || (PREVIEW_CITIES[city] ?? [city]).includes(s.city)) &&
          caps.every((c) => s.capabilities.includes(c)) &&
          certs.every((c) => s.certifications.includes(c)) &&
          (!highOnly || s.contact === "High")
      ),
    [q, city, caps, certs, highOnly]
  );

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const query = new URLSearchParams({ ...(q && { q }), ...(city && { city }) }).toString();

  return (
    <>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20">
        <h1
          className="text-[2.6rem] leading-[1.02] sm:text-[4.25rem] font-bold text-sl-ink tracking-[-0.025em] max-w-[15ch]"
          style={{ fontVariationSettings: '"wdth" 82' }}
        >
          Find the right local supplier in minutes, not weeks.
        </h1>
        <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-sl-steel">
          Suplist helps buyers find and compare industrial suppliers across Atlantic Canada, then send one quote
          request to several of them at once.
        </p>

        <form action="/suppliers" method="GET" className="mt-9 max-w-4xl">
          <div className="flex flex-col sm:flex-row bg-white border border-sl-line rounded-[10px] shadow-[0_1px_2px_rgba(20,32,46,0.06),0_8px_24px_-12px_rgba(20,32,46,0.18)] focus-within:border-sl-brand transition-colors">
            <label className="flex-1 flex items-center gap-3 px-4 py-3.5 sm:border-r border-b sm:border-b-0 border-sl-line">
              <Search className="w-5 h-5 text-sl-steel shrink-0" aria-hidden />
              <span className="sr-only">What do you need?</span>
              <input
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="What do you need? e.g. CWB welding, CNC machining"
                className="w-full bg-transparent text-base text-sl-ink placeholder:text-sl-steel/70 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 px-4 py-3.5 sm:w-52 border-b sm:border-b-0 border-sl-line">
              <MapPin className="w-4 h-4 text-sl-steel shrink-0" aria-hidden />
              <span className="sr-only">City</span>
              <select
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-transparent text-base text-sl-ink focus:outline-none cursor-pointer"
              >
                <option value="">All cities</option>
                {Object.keys(PREVIEW_CITIES).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <div className="p-2">
              <button
                type="submit"
                className="w-full sm:w-auto h-full px-6 py-3 rounded-[7px] bg-sl-brand hover:bg-sl-brand-dark text-white font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sl-brand transition-colors"
              >
                Find Suppliers
              </button>
            </div>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-sl-steel mr-1">Popular:</span>
          {POPULAR.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setQ(q.toLowerCase() === p.toLowerCase() ? "" : p)}
              aria-pressed={q.toLowerCase() === p.toLowerCase()}
              className={`px-3 py-1 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sl-brand ${
                q.toLowerCase() === p.toLowerCase()
                  ? "bg-sl-ink text-white border-sl-ink"
                  : "bg-white text-sl-ink border-sl-line hover:border-sl-steel"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-sl-ink">
          {supplierCount !== null && (
            <div>
              <dt className="text-sm text-sl-steel">Published suppliers</dt>
              <dd className="text-2xl font-semibold tabular-nums">{supplierCount}</dd>
            </div>
          )}
          <div className="sm:border-l sm:pl-10 border-sl-line">
            <dt className="text-sm text-sl-steel">Cities and towns covered</dt>
            <dd className="text-2xl font-semibold tabular-nums">{cityCount}</dd>
          </div>
          <div className="sm:border-l sm:pl-10 border-sl-line">
            <dt className="text-sm text-sl-steel">Cost to search</dt>
            <dd className="text-2xl font-semibold">Free</dd>
          </div>
        </dl>
      </section>

      {/* Live product preview: the hero search above drives these results. */}
      <section aria-label="Example search results" className="max-w-6xl mx-auto px-4 sm:px-6 mt-14 sm:mt-16">
        <div className="relative bg-white border border-sl-line rounded-xl shadow-[0_2px_4px_rgba(20,32,46,0.04),0_24px_48px_-24px_rgba(20,32,46,0.28)] overflow-hidden">
          {/* Window bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-sl-line bg-sl-paper">
            <span className="flex gap-1.5" aria-hidden>
              <span className="w-2.5 h-2.5 rounded-full bg-sl-line" />
              <span className="w-2.5 h-2.5 rounded-full bg-sl-line" />
              <span className="w-2.5 h-2.5 rounded-full bg-sl-line" />
            </span>
            <span className="flex-1 min-w-0 truncate text-xs text-sl-steel bg-white border border-sl-line rounded px-2.5 py-1">
              /suppliers{query ? `?${query}` : ""}
            </span>
            <span className="hidden sm:block text-xs text-sl-steel">Example results with sample companies</span>
          </div>

          <div className="grid md:grid-cols-[220px_1fr]">
            {/* Filters */}
            <aside className="hidden md:block border-r border-sl-line p-5 space-y-6 text-sm">
              <fieldset>
                <legend className="font-semibold text-sl-ink mb-2">Capabilities</legend>
                {CAPABILITY_FILTERS.map((c) => (
                  <label key={c} className="flex items-center gap-2 py-1 text-sl-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={caps.includes(c)}
                      onChange={() => toggle(caps, setCaps, c)}
                      className="accent-sl-brand w-4 h-4"
                    />
                    {c}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend className="font-semibold text-sl-ink mb-2">Certifications</legend>
                {CERT_FILTERS.map((c) => (
                  <label key={c} className="flex items-center gap-2 py-1 text-sl-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={certs.includes(c)}
                      onChange={() => toggle(certs, setCerts, c)}
                      className="accent-sl-brand w-4 h-4"
                    />
                    {c}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend className="font-semibold text-sl-ink mb-2">Contact confidence</legend>
                <label className="flex items-center gap-2 py-1 text-sl-ink cursor-pointer">
                  <input type="checkbox" checked={highOnly} onChange={() => setHighOnly(!highOnly)} className="accent-sl-brand w-4 h-4" />
                  High only
                </label>
              </fieldset>
            </aside>

            {/* Results */}
            <div className={`p-4 sm:p-5 ${tray.length ? "pb-28" : ""} transition-[padding]`}>
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-sm text-sl-ink">
                  <span className="font-semibold tabular-nums">{results.length}</span> supplier{results.length === 1 ? "" : "s"}
                  {q && <> for &ldquo;{q}&rdquo;</>}
                  {city && <> near {city}</>}
                </p>
                {(q || city || caps.length > 0 || certs.length > 0 || highOnly) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      setCity("");
                      setCaps([]);
                      setCerts([]);
                      setHighOnly(false);
                    }}
                    className="text-sm text-sl-brand hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <ul className="space-y-3 min-h-[420px] max-h-[620px] overflow-y-auto pr-1 -mr-1 overscroll-contain">
                {results.map((s) => {
                  const added = tray.includes(s.name);
                  return (
                    <li
                      key={s.name}
                      className={`border rounded-lg p-4 grid sm:grid-cols-[1fr_auto] gap-4 transition-colors ${
                        added ? "border-sl-brand bg-[#F5F9FF]" : "border-sl-line"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="font-semibold text-sl-ink">{s.name}</h3>
                          {s.claimed && (
                            <span className="inline-flex items-center gap-1 text-xs text-sl-verified">
                              <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
                              Claimed
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-sl-steel flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" aria-hidden />
                          {s.city}, {s.province}
                        </p>
                        <p className="mt-2 text-sm text-sl-ink/85">{s.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {s.capabilities.map((c) => (
                            <span key={c} className="text-xs px-2 py-0.5 rounded bg-sl-mist text-sl-ink">
                              {c}
                            </span>
                          ))}
                          {s.certifications.map((c) => (
                            <span key={c} className="text-xs px-2 py-0.5 rounded border border-[#E6CFA8] text-sl-provided bg-[#FDF8EF]">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex sm:flex-col sm:items-end justify-between gap-2 text-xs">
                        <div className="sm:text-right space-y-1">
                          <p className={`inline-flex items-center gap-1 ${s.contact === "High" ? "text-sl-verified" : "text-sl-provided"}`}>
                            <Phone className="w-3.5 h-3.5" aria-hidden />
                            {s.contact} confidence contact
                          </p>
                          <p className="text-sl-steel">{checked(s.checkedDaysAgo)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(tray, setTray, s.name)}
                          aria-pressed={added}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sl-brand ${
                            added
                              ? "bg-sl-brand text-white border-sl-brand"
                              : "bg-white text-sl-ink border-sl-line hover:border-sl-ink"
                          }`}
                        >
                          {added ? <Check className="w-4 h-4" aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />}
                          {added ? "Added" : "Add to Request"}
                        </button>
                      </div>
                    </li>
                  );
                })}
                {results.length === 0 && (
                  <li className="border border-dashed border-sl-line rounded-lg p-8 text-center text-sm text-sl-steel">
                    No example supplier matches. Try another word, or search the full directory.
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Request tray */}
          <div
            aria-live="polite"
            className={`absolute inset-x-0 bottom-0 border-t border-sl-ink bg-sl-ink text-white px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 motion-safe:transition-transform motion-safe:duration-300 ${
              tray.length ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <p className="text-sm font-semibold shrink-0">
              Request list <span className="tabular-nums text-white/70">({tray.length})</span>
            </p>
            <ul className="flex-1 flex flex-wrap gap-1.5 min-w-0">
              {tray.map((name) => (
                <li key={name} className="inline-flex items-center gap-1 text-xs bg-white/10 rounded px-2 py-1">
                  {name}
                  <button
                    type="button"
                    onClick={() => toggle(tray, setTray, name)}
                    aria-label={`Remove ${name}`}
                    className="text-white/70 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <Link
              href="/rfq/new"
              className="shrink-0 text-center px-4 py-2 rounded-md bg-white text-sl-ink text-sm font-semibold hover:bg-sl-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Send one request to {tray.length}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
