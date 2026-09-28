/**
 * Re-picks the three RFQ contacts for every supplier with the office-aware rules:
 * the branch in the supplier's listed city becomes the primary number, each phone
 * is labelled with its office, and the best email is always kept for quote requests.
 *
 * Run: npx tsx src/scripts/refresh_contacts.ts
 */
import "dotenv/config";
import { db } from "../lib/db";
import { applySupplierRfqContactSelection } from "../lib/contacts/selection";

async function main(): Promise<void> {
  const suppliers = await db.supplierCompany.findMany({ select: { id: true, canonicalName: true }, orderBy: { canonicalName: "asc" } });
  let withEmail = 0;
  let labelled = 0;

  for (const s of suppliers) {
    try {
      await applySupplierRfqContactSelection(s.id);
    } catch (err) {
      console.log(`  ${s.canonicalName}: could not refresh (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    const contacts = await db.contact.findMany({ where: { supplierCompanyId: s.id }, orderBy: { name: "asc" } });
    if (contacts.some((c) => c.publicBusinessEmail)) withEmail++;
    if (contacts.some((c) => c.title)) labelled++;
    const summary = contacts
      .map((c) => `${c.name?.startsWith("Primary") ? "★ " : ""}${c.publicBusinessPhone ?? c.publicBusinessEmail}${c.title ? ` (${c.title})` : ""}`)
      .join(" | ");
    console.log(`  ${s.canonicalName}: ${summary || "no usable contacts"}`);
  }

  console.log(`\nRefreshed ${suppliers.length} suppliers. With an email on file: ${withEmail}. With office labels: ${labelled}.`);
  await db.$disconnect();
}

main().catch(async (err: unknown) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
