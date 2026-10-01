"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Globe, UserRound, ShieldCheck } from "lucide-react";

type Provenance = "found" | "provided" | "verified";

const BADGE: Record<Provenance, { label: string; className: string; Icon: typeof Globe }> = {
  found: { label: "Publicly Discovered", className: "text-sl-found bg-[#EEF3F8] border-[#C9D6E4]", Icon: Globe },
  provided: { label: "Supplier Provided", className: "text-sl-provided bg-[#FDF8EF] border-[#E6CFA8]", Icon: UserRound },
  verified: { label: "Suplist Verified", className: "text-sl-verified bg-[#EEF7F2] border-[#BFDCCB]", Icon: ShieldCheck },
};

interface Fact {
  kind: string;
  value: string;
  provenance: Provenance;
  source: {
    /** Window title: the page address, or the place in Suplist the fact came from. */
    where: string;
    before: string;
    quote: string;
    after: string;
    note: string;
  };
}

const FACTS: Fact[] = [
  {
    kind: "Service",
    value: "Structural steel, stairs and railings",
    provenance: "found",
    source: {
      where: "harbourline-fab.example.ca/services",
      before: "Our Moncton shop has served Maritime builders since 1987. ",
      quote: "We fabricate and erect structural steel, stairs, railings and miscellaneous metals",
      after: " for commercial and industrial projects, with shop drawings prepared in-house.",
      note: "Found on the supplier's own services page during the last crawl.",
    },
  },
  {
    kind: "Phone",
    value: "(506) 555-0142, Moncton office",
    provenance: "found",
    source: {
      where: "harbourline-fab.example.ca/contact",
      before: "Truro office: (902) 555-0119. ",
      quote: "Moncton office: 220 Industrial Drive, Moncton, NB E1C 9P1. (506) 555-0142",
      after: ". Estimating: estimating@harbourline-fab.example.ca",
      note: "The office label comes from the address written next to the number.",
    },
  },
  {
    kind: "Standard",
    value: "CWB certified to CSA W47.1",
    provenance: "found",
    source: {
      where: "harbourline-fab.example.ca/about",
      before: "Quality matters on every job. ",
      quote: "Harbourline is certified by the Canadian Welding Bureau to CSA W47.1",
      after: " and holds a COR safety certificate.",
      note: "Shown as stated by the company. It becomes Suplist Verified only after an admin checks it.",
    },
  },
  {
    kind: "Year founded",
    value: "1987",
    provenance: "provided",
    source: {
      where: "Supplier portal: Harbourline Fabrication Ltd.",
      before: "Company profile, edited by Marc Cormier (Supplier Admin). ",
      quote: "Year founded: 1987",
      after: ". Website: harbourline-fab.example.ca",
      note: "Added by the company itself after claiming its profile.",
    },
  },
  {
    kind: "Capability",
    value: "Welding",
    provenance: "verified",
    source: {
      where: "Suplist review queue",
      before: "Supported by 3 pages: /services, /about, /projects. ",
      quote: "Approved and published by a Suplist admin",
      after: " after reviewing the evidence from each page.",
      note: "A person at Suplist confirmed this fact against its sources.",
    },
  },
];

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const { label, className, Icon } = BADGE[provenance];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${className}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function SourceTrace() {
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const quote = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<string | null>(null);

  // Draw the thread from the selected fact to the quoted source text.
  const measure = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    const row = rows.current[active]?.getBoundingClientRect();
    // The first line of the quote, so the thread lands where the quote starts.
    const q = quote.current?.getClientRects()[0];
    const side = panel.current?.getBoundingClientRect();
    if (!box || !row || !q || !side || window.innerWidth < 1024) return setPath(null);
    const x1 = row.right - box.left;
    const y1 = row.top + row.height / 2 - box.top;
    // Ends on the source panel's edge, level with the first line of the quote.
    const x2 = side.left - box.left;
    const y2 = q.top + q.height / 2 - box.top;
    const mid = (x1 + x2) / 2;
    setPath(`M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
  }, [active]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const fact = FACTS[active]!;
  const SourceIcon = BADGE[fact.provenance].Icon;

  return (
    <div ref={wrap} className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 lg:gap-24">
      <ul className="space-y-2" aria-label="Facts on a supplier profile">
        {FACTS.map((f, i) => (
          <li key={f.kind}>
            <button
              ref={(el) => {
                rows.current[i] = el;
              }}
              type="button"
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              aria-pressed={i === active}
              className={`w-full text-left rounded-lg border px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sl-brand ${
                i === active ? "bg-white border-sl-ink shadow-[0_6px_16px_-10px_rgba(20,32,46,0.35)]" : "bg-white/60 border-sl-line hover:border-sl-steel"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-xs text-sl-steel">{f.kind}</span>
                  <span className="block font-medium text-sl-ink">{f.value}</span>
                </span>
                <span className="shrink-0 pt-0.5">
                  <ProvenanceBadge provenance={f.provenance} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div ref={panel} aria-live="polite" className="self-center bg-white border border-sl-line rounded-xl overflow-hidden shadow-[0_2px_4px_rgba(20,32,46,0.04),0_18px_36px_-22px_rgba(20,32,46,0.3)]">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-sl-line bg-sl-paper text-xs text-sl-steel">
          <SourceIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span className="truncate">{fact.source.where}</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2" aria-hidden>
            <div className="h-2 w-2/5 rounded bg-sl-mist" />
            <div className="h-2 w-3/4 rounded bg-sl-mist" />
          </div>
          <p className="text-[0.95rem] leading-7 text-sl-steel">
            {fact.source.before}
            <mark ref={quote} className="bg-[#FFF1C2] text-sl-ink rounded-sm px-0.5 [box-decoration-break:clone]">
              {fact.source.quote}
            </mark>
            {fact.source.after}
          </p>
          <div className="space-y-2" aria-hidden>
            <div className="h-2 w-full rounded bg-sl-mist" />
            <div className="h-2 w-2/3 rounded bg-sl-mist" />
          </div>
          <p className="pt-3 border-t border-sl-line text-sm text-sl-ink">{fact.source.note}</p>
        </div>
      </div>

      {path && (
        <svg className="pointer-events-none absolute inset-0 w-full h-full overflow-visible hidden lg:block" aria-hidden>
          <path d={path} fill="none" stroke="#14202E" strokeWidth="1.25" strokeDasharray="3 4" />
          <circle cx={path.split(" ")[0]!.slice(1)} cy={path.split(" ")[1]} r="3.5" fill="#14202E" />
          <circle cx={path.split(" ").at(-2)} cy={path.split(" ").at(-1)} r="3.5" fill="#FFF1C2" stroke="#14202E" strokeWidth="1.25" />
        </svg>
      )}
    </div>
  );
}
