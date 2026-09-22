import Link from "next/link";
import { Search, MapPin, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

export default function HomePage() {
  const quickCategories = [
    { name: "Structural Steel Fabrication", slug: "structural-steel-fabrication" },
    { name: "Stainless Steel Fabrication", slug: "stainless-steel-fabrication" },
    { name: "Welding", slug: "welding" },
    { name: "Machining", slug: "machining" },
    { name: "Pipe Fabrication", slug: "pipe-fabrication" },
    { name: "Electrical Contracting", slug: "electrical-contracting" },
    { name: "Mechanical/HVAC", slug: "mechanical-hvac" },
    { name: "Field Installation", slug: "field-installation" },
  ];

  const featuredRegions = [
    { city: "Fredericton", province: "NB", count: "14+ Suppliers" },
    { city: "Saint John", province: "NB", count: "22+ Suppliers" },
    { city: "Moncton", province: "NB", count: "18+ Suppliers" },
  ];

  return (
    <div className="space-y-16 py-8 max-w-6xl mx-auto px-4">
      {/* Hero Section */}
      <section className="text-center space-y-8 py-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-atlantic-800 bg-atlantic-50 rounded-full border border-atlantic-200">
          <ShieldCheck className="w-4 h-4 text-atlantic-600" />
          Evidence-Backed Supplier Intelligence for Atlantic Canada
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
          Find qualified Atlantic Canadian suppliers.
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-slate-600">
          Discover verified industrial fabrication, machining, electrical, and mechanical contractors across New Brunswick with deterministic capability matching and source provenance.
        </p>

        {/* Immediately Visible Search Bar */}
        <div className="max-w-3xl mx-auto bg-white p-3 border border-slate-200 rounded-2xl shadow-lg">
          <form action="/suppliers" method="GET" className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                name="q"
                placeholder="Search capabilities (e.g. Structural steel, CWB W47.1, CNC Machining)..."
                className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl sm:w-48">
              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                name="city"
                className="w-full bg-transparent text-sm text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="">All Cities</option>
                <option value="Saint John">Saint John, NB</option>
                <option value="Fredericton">Fredericton, NB</option>
                <option value="Moncton">Moncton, NB</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-6 py-3 bg-atlantic-600 text-white text-sm font-bold rounded-xl hover:bg-atlantic-700 transition flex items-center justify-center gap-2 shadow"
            >
              Search Directory
            </button>
          </form>
        </div>

        {/* Quick Category Chips */}
        <div className="pt-4 space-y-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Popular Industrial Service Categories
          </span>
          <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
            {quickCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/suppliers?capability=${cat.slug}`}
                className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:border-atlantic-500 hover:text-atlantic-600 text-xs font-medium rounded-full transition shadow-sm"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Regional Focus Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {featuredRegions.map((region) => (
          <Link
            key={region.city}
            href={`/suppliers?city=${encodeURIComponent(region.city)}`}
            className="group bg-white border border-slate-200 hover:border-atlantic-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-500 font-bold uppercase">
                {region.province} Region
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-atlantic-600 group-hover:translate-x-1 transition" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">{region.city}</h3>
            <p className="text-xs text-slate-500 font-medium">{region.count}</p>
          </Link>
        ))}
      </section>

      {/* Trust & Guarantee Banner */}
      <section className="bg-slate-900 text-white rounded-2xl p-8 sm:p-12 shadow-xl space-y-6">
        <div className="max-w-3xl space-y-4">
          <span className="px-3 py-1 bg-atlantic-900 text-atlantic-300 border border-atlantic-700 text-xs font-mono uppercase font-bold rounded">
            Zero AI Market Intelligence
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold">
            100% Evidence-Backed Capability Claims
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Every capability, location, and certification on AtlanticSource is backed by explicit source provenance — raw HTML snippets, locators, and human admin review.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>No AI Hallucinations</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Deterministic Match Rules</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Strict Verification Guard</span>
          </div>
        </div>
      </section>
    </div>
  );
}
