import Link from "next/link";

interface LogoProps {
  /** "light" for pale backgrounds, "dark" for the dark admin/portal sidebars. */
  tone?: "light" | "dark";
  href?: string;
  suffix?: string;
}

/** The one AtlanticSource brand mark used everywhere. */
export function Logo({ tone = "light", href = "/", suffix }: LogoProps) {
  return (
    <Link href={href} className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
      <span className="w-8 h-8 rounded-lg bg-atlantic-600 text-white flex items-center justify-center text-xs font-black">AS</span>
      <span className={tone === "dark" ? "text-white" : "text-slate-900"}>AtlanticSource</span>
      {suffix && (
        <span className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          {suffix}
        </span>
      )}
    </Link>
  );
}
