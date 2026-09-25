import Link from "next/link";
import { ProfileStatusEnum } from "@prisma/client";
import {
  Search,
  MapPin,
  ShieldCheck,
  ArrowRight,
  FileSearch,
  Send,
  Clock,
  PhoneOff,
  HelpCircle,
  Building2,
  HardHat,
} from "lucide-react";
import { db } from "@/lib/db";
import { metroTowns } from "@/lib/locations/address";

// Numbers on this page come from the live database.
export const dynamic = "force-dynamic";

const CITIES = ["Saint John", "Fredericton", "Moncton"] as const;

interface LandingStats {
  suppliers: number;
  services: number;
  cities: Record<string, number>;
}

async function loadStats(): Promise<LandingStats | null> {
  try {
    const published = { profileStatus: ProfileStatusEnum.PUBLISHED };
    const [suppliers, services, ...cityCounts] = await Promise.all([
      db.supplierCompany.count({ where: published }),
      db.capability.count({ where: { supplierCapabilities: { some: { published: true, supplierCompany: published } } } }),
      ...CITIES.map((city) =>
        db.supplierCompany.count({
          where: {
            ...published,
            locations: { some: { OR: metroTowns(city).map((town) => ({ city: { equals: town, mode: "insensitive" as const } })) } },
          },
        })
      ),
    ]);
    return { suppliers, services, cities: Object.fromEntries(CITIES.map((c, i) => [c, cityCounts[i] ?? 0])) };
  } catch {
    return null;
  }
}

const CATEGORIES = [
  { name: "Structural Steel", slug: "structural-steel-fabrication" },
  { name: "Welding", slug: "welding" },
  { name: "Machining", slug: "machining" },
  { name: "Pipe Fabrication", slug: "pipe-fabrication" },
  { name: "Electrical", slug: "electrical-contracting" },
  { name: "Mechanical / HVAC", slug: "mechanical-hvac" },
  { name: "Field Installation", slug: "field-installation" },
];

const PROBLEMS = [
  { icon: Search, text: "Endless Googling for shops that may not do what you need" },
  { icon: PhoneOff, text: "Calling around just to learn if they're certified or still in business" },
  { icon: Clock, text: "Days lost before a single quote comes back" },
];

const STEPS = [
  {
    icon: Search,
    title: "Search by what you need",
    text: "Type a service, certification or city — like “CWB welding in Saint John”.",
  },
  {
    icon: FileSearch,
    title: "See the proof",
    text: "Every capability and certification shows exactly where it came from on the supplier’s own website.",
  },
  {
    icon: Send,
    title: "Request quotes in one go",
    text: "Add suppliers to your list and send one request to all of them at once.",
  },
];

export default async function HomePage() {
  const stats = await loadStats();

  return (
    <div className="bg-slate-50">
      {/* Top bar */}
      <header className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-slate-900 text-lg">
          <span className="w-8 h-8 rounded-lg bg-atlantic-600 text-white flex items-center justify-center text-sm">AS</span>
          AtlanticSource
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
          <Link href="/suppliers" className="hover:text-atlantic-600">Browse suppliers</Link>
          <Link href="/data-sources" className="hidden sm:inline hover:text-atlantic-600">Where our data comes from</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-16 text-center space-y-7">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-atlantic-800 bg-atlantic-50 rounded-full border border-atlantic-200">
          <MapPin className="w-3.5 h-3.5 text-atlantic-600" />
          Built for Atlantic Canada industry
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.1]">
          Find the right local supplier <span className="text-atlantic-600">in minutes</span>, not weeks.
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-slate-600">
          One place to find fabricators, machine shops, welders, electrical and mechanical contractors across New Brunswick — with proof of what they actually do.
        </p>

        <div className="max-w-3xl mx-auto bg-white p-3 border border-slate-200 rounded-2xl shadow-lg">
          <form action="/suppliers" method="GET" className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                name="q"
                aria-label="What do you need?"
                placeholder="e.g. welding, CNC machining, ISO 9001"
                className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl sm:w-48">
              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select name="city" aria-label="City" className="w-full bg-transparent text-sm text-slate-900 focus:outline-none cursor-pointer">
                <option value="">All cities</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}, NB</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-atlantic-600 text-white text-sm font-bold rounded-xl hover:bg-atlantic-700 transition flex items-center justify-center gap-2 shadow"
            >
              Find suppliers
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/suppliers?capability=${cat.slug}`}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:border-atlantic-500 hover:text-atlantic-600 text-xs font-medium rounded-full transition shadow-sm"
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {stats && stats.suppliers > 0 && (
          <dl className="grid grid-cols-3 max-w-xl mx-auto pt-6 border-t border-slate-200">
            <div>
              <dt className="text-xs text-slate-500">Suppliers listed</dt>
              <dd className="text-3xl font-extrabold text-slate-900">{stats.suppliers}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Services covered</dt>
              <dd className="text-3xl font-extrabold text-slate-900">{stats.services}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Cost to search</dt>
              <dd className="text-3xl font-extrabold text-slate-900">$0</dd>
            </div>
          </dl>
        )}
      </section>

      {/* The problem */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-atlantic-600">The problem</span>
            <h2 className="text-3xl font-extrabold text-slate-900">Finding a qualified local shop shouldn’t take a week of phone calls.</h2>
            <p className="text-slate-600">
              The capable suppliers are here — they’re just hard to find, and harder to compare. AtlanticSource puts them in one searchable place.
            </p>
          </div>
          <ul className="space-y-3">
            {PROBLEMS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <Icon className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 py-16 space-y-10">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-atlantic-600">How it works</span>
          <h2 className="text-3xl font-extrabold text-slate-900">Three steps from “who can do this?” to quotes.</h2>
        </div>
        <ol className="grid md:grid-cols-3 gap-6">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-atlantic-50 text-atlantic-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">STEP {i + 1}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="bg-slate-900 text-white rounded-2xl p-8 sm:p-12 grid md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-2 space-y-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <h2 className="text-2xl sm:text-3xl font-bold">No guesswork. Every fact shows its source.</h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
              We read each supplier’s own website and keep the exact sentence behind every claim. Weak or unclear claims are rejected or checked by a person, and certifications are never shown without review.
            </p>
          </div>
          <Link
            href="/data-sources"
            className="justify-self-start md:justify-self-end px-5 py-3 bg-white text-slate-900 text-sm font-bold rounded-xl hover:bg-slate-100 transition flex items-center gap-2"
          >
            How we check suppliers
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Cities */}
      <section className="max-w-6xl mx-auto px-4 pb-16 space-y-6">
        <h2 className="text-2xl font-extrabold text-slate-900">Browse by city</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CITIES.map((city) => {
            const count = stats?.cities[city];
            return (
              <Link
                key={city}
                href={`/suppliers?city=${encodeURIComponent(city)}`}
                className="group bg-white border border-slate-200 hover:border-atlantic-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500 font-bold uppercase">New Brunswick</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-atlantic-600 group-hover:translate-x-1 transition" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{city}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {count ? `${count} supplier${count === 1 ? "" : "s"}` : "View suppliers"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Two audiences */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 p-8 space-y-4">
            <HardHat className="w-8 h-8 text-atlantic-600" />
            <h3 className="text-xl font-bold text-slate-900">Buying for a project?</h3>
            <p className="text-sm text-slate-600">
              Build a shortlist of local suppliers who can actually do the work, and send them all one quote request.
            </p>
            <Link href="/suppliers" className="inline-flex items-center gap-2 px-5 py-2.5 bg-atlantic-600 text-white text-sm font-bold rounded-xl hover:bg-atlantic-700 transition">
              Start searching
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 p-8 space-y-4">
            <Building2 className="w-8 h-8 text-atlantic-600" />
            <h3 className="text-xl font-bold text-slate-900">Run a local shop?</h3>
            <p className="text-sm text-slate-600">
              You may already be listed. Get found by buyers looking for exactly what you do — and let us know if anything about your company is wrong.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/suppliers" className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition">
                Find your company
              </Link>
              <Link href="/report-stale" className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition">
                <HelpCircle className="w-4 h-4" />
                Report a correction
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} AtlanticSource</span>
          <div className="flex gap-4">
            <Link href="/data-sources" className="hover:text-slate-700">Data sources</Link>
            <Link href="/privacy" className="hover:text-slate-700">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-700">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
