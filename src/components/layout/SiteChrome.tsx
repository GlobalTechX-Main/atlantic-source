"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/** Areas with their own sidebar layout (admin console, supplier portal). */
const APP_AREAS = ["/admin", "/portal"];

/** Wraps every public page in the shared navbar and footer. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isAppArea = APP_AREAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isAppArea) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
