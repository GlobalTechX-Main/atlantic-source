import Link from "next/link";

interface LogoProps {
  /** "light" for pale backgrounds, "dark" for the dark admin/portal sidebars. */
  tone?: "light" | "dark";
  href?: string;
  suffix?: string;
}

/** The one Suplist brand mark used everywhere. */
export function Logo({ tone = "light", href = "/", suffix }: LogoProps) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="Suplist home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tone === "dark" ? "/brand/suplist-logo-white.png" : "/brand/suplist-logo.png"}
        alt="Suplist"
        width={389}
        height={113}
        className="h-8 w-auto"
      />
      {suffix && (
        <span className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          {suffix}
        </span>
      )}
    </Link>
  );
}
