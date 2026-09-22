import { db } from "../lib/db";

async function auditDbForSmokeTest() {
  const buyerUsers = await db.user.findMany({
    include: { buyerMemberships: { include: { buyerOrganization: true } } }
  });
  console.log("=== BUYER USERS IN DB ===");
  buyerUsers.forEach(u => {
    console.log(`ID: ${u.id} | Email: ${u.email} | Memberships: ${u.buyerMemberships.length}`);
    u.buyerMemberships.forEach(m => console.log(`   -> Org: ${m.buyerOrganization.name} (${m.buyerOrganization.id}) | Role: ${m.role}`));
  });

  const buyerOrgs = await db.buyerOrganization.findMany();
  console.log("\n=== BUYER ORGS IN DB (" + buyerOrgs.length + ") ===");
  buyerOrgs.forEach(o => console.log(`Org ID: ${o.id} | Name: ${o.name}`));

  const suppliers = await db.supplierCompany.findMany({
    include: { contacts: true }
  });

  console.log("\n=== ALL SUPPLIERS IN DB (" + suppliers.length + ") ===");
  let publishedCount = 0;
  let withEmailCount = 0;
  suppliers.forEach(s => {
    if (s.profileStatus === "PUBLISHED") publishedCount++;
    const emails = s.contacts.map(c => c.publicBusinessEmail).filter(Boolean);
    if (emails.length > 0) withEmailCount++;
    console.log(`- ${s.canonicalName} (${s.normalizedDomain}) | Status: ${s.profileStatus} | Contacts: ${s.contacts.length} | Emails: ${emails.join(", ") || "NONE"}`);
  });
  console.log(`\nPublished: ${publishedCount} / ${suppliers.length}`);
  console.log(`With Email Contact: ${withEmailCount} / ${suppliers.length}`);

  await db.$disconnect();
}

auditDbForSmokeTest().catch(console.error);
