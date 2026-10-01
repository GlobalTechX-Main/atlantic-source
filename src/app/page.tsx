import Link from "next/link";
import "@fontsource-variable/archivo/wdth.css";
import { ProfileStatusEnum } from "@prisma/client";
import { Search, MapPin, Check, Minus } from "lucide-react";
import { db } from "@/lib/db";
import { metroTowns } from "@/lib/locations/address";
import { HeroSearch } from "@/components/landing/HeroSearch";
import { SourceTrace, ProvenanceBadge } from "@/components/landing/SourceTrace";

// Numbers on this page come from the live database.
export const dynamic = "force-dynamic";

/** Cities on the map, placed by latitude and longitude. */
const CITIES = [
  { name: "Moncton", province: "NB", lat: 46.09, lon: -64.78, label: "above" },
  { name: "Saint John", province: "NB", lat: 45.27, lon: -66.06, label: "right" },
  { name: "Fredericton", province: "NB", lat: 45.96, lon: -66.64, label: "below" },
  { name: "Bathurst", province: "NB", lat: 47.62, lon: -65.65, label: "right" },
  { name: "Halifax", province: "NS", lat: 44.65, lon: -63.58, label: "right" },
  { name: "Charlottetown", province: "PE", lat: 46.24, lon: -63.13, label: "right" },
  { name: "St. John's", province: "NL", lat: 47.56, lon: -52.71, label: "left" },
] as const;

/** Province names, placed roughly in each province on the map. */
const PROVINCES = [
  { name: "New Brunswick", lat: 46.85, lon: -66.9 },
  { name: "Nova Scotia", lat: 45.05, lon: -62.6 },
  { name: "PEI", lat: 46.75, lon: -63.6 },
  { name: "Newfoundland", lat: 47.95, lon: -56.4 },
] as const;

interface LandingStats {
  suppliers: number;
  towns: number;
  cities: Record<string, number>;
}

async function loadStats(): Promise<LandingStats | null> {
  try {
    const published = { profileStatus: ProfileStatusEnum.PUBLISHED };
    const [suppliers, towns, ...cityCounts] = await Promise.all([
      db.supplierCompany.count({ where: published }),
      db.supplierLocation.findMany({ where: { supplierCompany: published }, distinct: ["city"], select: { city: true } }),
      ...CITIES.map((c) =>
        db.supplierCompany.count({
          where: {
            ...published,
            locations: { some: { OR: metroTowns(c.name).map((town) => ({ city: { equals: town, mode: "insensitive" as const } })) } },
          },
        })
      ),
    ]);
    return {
      suppliers,
      towns: towns.length,
      cities: Object.fromEntries(CITIES.map((c, i) => [c.name, cityCounts[i] ?? 0])),
    };
  } catch {
    return null;
  }
}

const OLD_WAY = ["Search", "20 websites", "Calls", "Emails", "Waiting", "Spreadsheets"];
const NEW_WAY = ["Search", "Compare", "Request"];

function Chain({ items, strong }: { items: readonly string[]; strong?: boolean }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {items.map((item, i) => (
        <li key={item} className="flex items-center">
          {i > 0 && (
            <svg width="28" height="10" viewBox="0 0 28 10" className={`mx-1 ${strong ? "text-sl-brand" : "text-sl-line"}`} aria-hidden>
              <path d="M2 5h22M20 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
          <span
            className={
              strong
                ? "px-4 py-2 rounded-md bg-sl-brand text-white font-semibold"
                : "px-3 py-1.5 rounded-md border border-dashed border-sl-line text-sl-steel bg-white"
            }
          >
            {item}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function HomePage() {
  const stats = await loadStats();
  const max = Math.max(1, ...Object.values(stats?.cities ?? {}));

  // Map projection: Atlantic Canada, longitude −67.5…−52 and latitude 44…48.
  const W = 560;
  const H = 300;
  const px = (lon: number) => 24 + ((lon + 67.5) / 15.5) * (W - 48);
  const py = (lat: number) => 28 + ((48 - lat) / 4) * (H - 56);

  return (
    <div className="bg-sl-paper text-sl-ink font-archivo">
      <HeroSearch supplierCount={stats?.suppliers ?? null} cityCount={stats?.towns ?? CITIES.length} />

      {/* Problem → solution */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] max-w-[22ch]" style={{ fontVariationSettings: '"wdth" 85' }}>
          Sourcing shouldn&rsquo;t take a week of phone calls.
        </h2>
        <div className="mt-10 grid gap-8 sm:gap-6">
          <div className="grid sm:grid-cols-[140px_1fr] gap-3 sm:items-center">
            <p className="text-sm text-sl-steel">Today, about a week</p>
            <div>
              <Chain items={OLD_WAY} />
            </div>
          </div>
          <div className="grid sm:grid-cols-[140px_1fr] gap-3 sm:items-center">
            <p className="text-sm font-semibold">With Suplist, minutes</p>
            <Chain items={NEW_WAY} strong />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-sl-line bg-white scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em]" style={{ fontVariationSettings: '"wdth" 85' }}>
            How it works
          </h2>
          <ol className="mt-12 grid md:grid-cols-3 gap-10 md:gap-8">
            <li>
              <p className="text-sm font-semibold text-sl-brand tabular-nums">01</p>
              <h3 className="mt-1 text-xl font-semibold">Search</h3>
              <p className="mt-1 text-sl-steel">Find suppliers by capability, location or certification.</p>
              <div className="mt-5 border border-sl-line rounded-lg p-3 bg-sl-paper text-sm" aria-hidden>
                <div className="flex items-center gap-2 bg-white border border-sl-line rounded-md px-2.5 py-2">
                  <Search className="w-4 h-4 text-sl-steel" />
                  <span>CWB welding</span>
                  <span className="ml-auto flex items-center gap-1 text-sl-steel">
                    <MapPin className="w-3.5 h-3.5" />
                    Moncton
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {["Harbourline Fabrication Ltd.", "Petitcodiac Stainless"].map((n) => (
                    <div key={n} className="flex items-center justify-between bg-white border border-sl-line rounded-md px-2.5 py-2">
                      <span className="truncate">{n}</span>
                      <span className="text-xs text-sl-steel shrink-0 ml-2">Moncton, NB</span>
                    </div>
                  ))}
                </div>
              </div>
            </li>
            <li>
              <p className="text-sm font-semibold text-sl-brand tabular-nums">02</p>
              <h3 className="mt-1 text-xl font-semibold">Compare</h3>
              <p className="mt-1 text-sl-steel">Review supplier profiles and the information behind them.</p>
              <div className="mt-5 border border-sl-line rounded-lg bg-sl-paper text-sm overflow-hidden" aria-hidden>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-sl-steel">
                      <th className="font-normal px-3 py-2" />
                      <th className="font-medium px-3 py-2">Harbourline</th>
                      <th className="font-medium px-3 py-2">Chignecto</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {[
                      ["Structural steel", true, false],
                      ["CWB W47.1", true, true],
                      ["Moncton office", true, true],
                    ].map(([label, a, b]) => (
                      <tr key={label as string} className="border-t border-sl-line">
                        <td className="px-3 py-2">{label}</td>
                        {[a, b].map((v, i) => (
                          <td key={i} className="px-3 py-2">
                            {v ? <Check className="w-4 h-4 text-sl-verified" /> : <Minus className="w-4 h-4 text-sl-line" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t border-sl-line">
                      <td className="px-3 py-2">Contact</td>
                      <td className="px-3 py-2 text-sl-verified">High</td>
                      <td className="px-3 py-2 text-sl-verified">High</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </li>
            <li>
              <p className="text-sm font-semibold text-sl-brand tabular-nums">03</p>
              <h3 className="mt-1 text-xl font-semibold">Request</h3>
              <p className="mt-1 text-sl-steel">Send one sourcing request to several suppliers.</p>
              <div className="mt-5 border border-sl-line rounded-lg p-3 bg-sl-paper text-sm" aria-hidden>
                <p className="font-medium px-1">Stair tower for boiler house</p>
                <p className="text-xs text-sl-steel px-1">Moncton, NB. Replies due in 12 days</p>
                <div className="mt-2 space-y-1.5">
                  {[
                    ["Harbourline", "Quote: $78,500", "text-sl-verified"],
                    ["Chignecto Pipe", "Waiting", "text-sl-steel"],
                    ["Petitcodiac", "Declined", "text-sl-provided"],
                  ].map(([n, s, c]) => (
                    <div key={n} className="flex items-center justify-between bg-white border border-sl-line rounded-md px-2.5 py-2">
                      <span>{n}</span>
                      <span className={`text-xs font-medium ${c}`}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Trust: where each fact came from */}
      <section className="border-t border-sl-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em]" style={{ fontVariationSettings: '"wdth" 85' }}>
              Know where the information came from.
            </h2>
            <p className="mt-4 text-lg text-sl-steel">
              Every fact on a Suplist profile links back to its source. Pick a fact to see where it was found.
            </p>
          </div>
          <dl className="mt-8 grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <dt><ProvenanceBadge provenance="found" /></dt>
              <dd className="mt-2 text-sl-steel">Read from the supplier&rsquo;s own website, with a link to the page.</dd>
            </div>
            <div>
              <dt><ProvenanceBadge provenance="provided" /></dt>
              <dd className="mt-2 text-sl-steel">Added by the company after claiming its profile.</dd>
            </div>
            <div>
              <dt><ProvenanceBadge provenance="verified" /></dt>
              <dd className="mt-2 text-sl-steel">Checked against its sources by a person at Suplist.</dd>
            </div>
          </dl>
          <div className="mt-12">
            <SourceTrace />
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="border-t border-sl-line bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24 grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em]" style={{ fontVariationSettings: '"wdth" 85' }}>
              Suppliers across Atlantic Canada
            </h2>
            <p className="mt-4 text-sl-steel max-w-[44ch]">
              Search a city and nearby towns are included. Moncton also finds Dieppe and Riverview.
            </p>
            <ul className="mt-8 divide-y divide-sl-line border-y border-sl-line">
              {CITIES.map((c) => {
                const n = stats?.cities[c.name] ?? 0;
                return (
                  <li key={c.name}>
                    <Link
                      href={`/suppliers?city=${encodeURIComponent(c.name)}`}
                      className="flex items-center justify-between py-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-sl-brand rounded"
                    >
                      <span className="font-medium group-hover:text-sl-brand transition-colors">
                        {c.name}, {c.province}
                      </span>
                      <span className="text-sm text-sl-steel tabular-nums">
                        {n > 0 ? `${n} supplier${n === 1 ? "" : "s"}` : "Being added"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <figure className="border border-sl-line rounded-xl bg-sl-paper p-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Map of the cities Suplist covers in Atlantic Canada">
              {/* Faint graticule: one line per degree */}
              {Array.from({ length: 16 }, (_, i) => -67 + i).map((lon) => (
                <line key={lon} x1={px(lon)} x2={px(lon)} y1={20} y2={H - 20} stroke="#D6DCE3" strokeWidth="0.75" strokeDasharray="1 5" />
              ))}
              {[45, 46, 47].map((lat) => (
                <line key={lat} x1={16} x2={W - 16} y1={py(lat)} y2={py(lat)} stroke="#D6DCE3" strokeWidth="0.75" strokeDasharray="1 5" />
              ))}
              {PROVINCES.map((p) => (
                <text key={p.name} x={px(p.lon)} y={py(p.lat)} textAnchor="middle" fontSize="11" fill="#5A6775" fillOpacity="0.7" letterSpacing="0.04em">
                  {p.name}
                </text>
              ))}
              {CITIES.map((c) => {
                const n = stats?.cities[c.name] ?? 0;
                const r = 5 + (n / max) * 14;
                const x = px(c.lon);
                const y = py(c.lat);
                const lx = c.label === "left" ? x - 10 : c.label === "above" || c.label === "below" ? x : x + 10;
                const ly = c.label === "above" ? y - r - 6 : c.label === "below" ? y + r + 14 : y + 4;
                const anchor = c.label === "left" ? "end" : c.label === "above" || c.label === "below" ? "middle" : "start";
                return (
                  <g key={c.name}>
                    {n > 0 && <circle cx={x} cy={y} r={r} fill="#1F6FEB" fillOpacity="0.16" />}
                    <circle cx={x} cy={y} r="3.5" fill={n > 0 ? "#1F6FEB" : "#5A6775"} />
                    <text x={lx} y={ly} textAnchor={anchor} fontSize="13" fontWeight="600" fill="#14202E" fontFamily="inherit">
                      {c.name}
                    </text>
                  </g>
                );
              })}
            </svg>
            <figcaption className="px-2 pb-1 text-xs text-sl-steel">Circle size shows how many suppliers are listed near each city.</figcaption>
          </figure>
        </div>
      </section>

      {/* For suppliers */}
      <section id="for-suppliers" className="border-t border-sl-line scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em]" style={{ fontVariationSettings: '"wdth" 85' }}>
              Is your company already on Suplist?
            </h2>
            <p className="mt-2 text-sl-steel">
              Claim your profile and keep your information up to date. Find your company, then choose Claim on its profile.
            </p>
          </div>
          <Link
            href="/suppliers"
            className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-md border border-sl-ink text-sl-ink font-semibold hover:bg-sl-ink hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sl-brand"
          >
            Claim Your Profile →
          </Link>
        </div>
      </section>

      {/* Final call to action */}
      <section className="bg-sl-ink text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
          <h2 className="text-4xl sm:text-6xl font-bold tracking-[-0.025em] leading-[1.02]" style={{ fontVariationSettings: '"wdth" 82' }}>
            Find your next supplier.
          </h2>
          <Link
            href="/suppliers"
            className="shrink-0 inline-flex items-center justify-center px-6 py-3.5 rounded-md bg-sl-brand hover:bg-sl-brand-dark text-white font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Find Suppliers →
          </Link>
        </div>
      </section>
    </div>
  );
}
