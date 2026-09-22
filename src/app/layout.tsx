import type { Metadata } from "next";
import "./globals.css";
import { SupplierCartDrawer, SupplierCartProvider } from "@/components/rfq/SupplierCart";

export const metadata: Metadata = {
  title: "AtlanticSource — B2B Supplier Intelligence & Sourcing",
  description: "B2B supplier intelligence and sourcing marketplace for Atlantic Canada (Fredericton, Saint John, Moncton). Discover verified industrial suppliers and request quotes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        <SupplierCartProvider>
          {children}
          <SupplierCartDrawer />
        </SupplierCartProvider>
      </body>
    </html>
  );
}
