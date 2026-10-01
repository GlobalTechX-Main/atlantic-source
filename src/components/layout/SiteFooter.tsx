import Link from "next/link";
import { Logo } from "./Logo";

const COLUMNS = [
  {
    title: "For buyers",
    links: [
      { href: "/suppliers", label: "Browse suppliers" },
      { href: "/rfq/new", label: "Request quotes" },
      { href: "/buyer/dashboard", label: "My requests" },
    ],
  },
  {
    title: "For suppliers",
    links: [
      { href: "/suppliers", label: "Find your company" },
      { href: "/report-stale", label: "Report a correction" },
      { href: "/portal", label: "Supplier portal" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/data-sources", label: "How we check data" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-12 grid gap-10 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-slate-500 leading-relaxed">
            Find qualified industrial suppliers across Atlantic Canada, with proof of what they actually do.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">{col.title}</h2>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-slate-500 hover:text-atlantic-600 transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Suplist. Supplier details come from public company websites.</span>
          <span>New Brunswick · Nova Scotia · PEI · Newfoundland &amp; Labrador</span>
        </div>
      </div>
    </footer>
  );
}
