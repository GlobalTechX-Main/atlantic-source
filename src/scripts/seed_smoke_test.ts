import "dotenv/config";
import { ProfileStatusEnum, ClaimStatusEnum, VerificationStatusEnum, VerificationStateEnum } from "@prisma/client";
import { db } from "../lib/db";

export async function runSmokeTestSeed() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error("[SAFETY GUARD] Refusing to run development smoke-test seed script in PRODUCTION environment.");
  }

  console.log("=== EXECUTING ISOLATED SMOKE-TEST SEED ===");

  const adminEmail = "admin@atlanticsource.ca";
  const user = await db.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Atlantic Admin User",
      normalizedEmail: adminEmail,
    },
    create: {
      id: "usr_admin_smoke_test",
      email: adminEmail,
      normalizedEmail: adminEmail,
      name: "Atlantic Admin User",
      isPlatformAdmin: true,
    },
  });
  console.log(`[USER] Admin User Ready: ${user.email} (ID: ${user.id})`);

  const buyerOrg = await db.buyerOrganization.upsert({
    where: { id: "org_atlantic_procurement" },
    update: {
      name: "Atlantic Procurement Corp",
      website: "https://atlanticprocurement.ca",
      normalizedDomain: "atlanticprocurement.ca",
    },
    create: {
      id: "org_atlantic_procurement",
      name: "Atlantic Procurement Corp",
      website: "https://atlanticprocurement.ca",
      normalizedDomain: "atlanticprocurement.ca",
    },
  });
  console.log(`[BUYER ORG] Buyer Org Ready: ${buyerOrg.name} (ID: ${buyerOrg.id})`);

  const membership = await db.buyerMembership.upsert({
    where: {
      id: "memb_admin_buyer",
    },
    update: {
      role: "BUYER_ADMIN",
    },
    create: {
      id: "memb_admin_buyer",
      userId: user.id,
      buyerOrganizationId: buyerOrg.id,
      role: "BUYER_ADMIN",
    },
  });
  console.log(`[BUYER MEMBERSHIP] Membership Linked: User ${user.email} -> Org ${buyerOrg.name} (Role: ${membership.role})`);

  const email1 = process.env.SMOKE_TEST_SUPPLIER_EMAIL_1 || "supplier1@atlanticsource.ca";
  const email2 = process.env.SMOKE_TEST_SUPPLIER_EMAIL_2 || "supplier2@atlanticsource.ca";

  // Supplier 1: Steel & Fabrication
  const supp1 = await db.supplierCompany.upsert({
    where: { slug: "atlantic-steel-smoke-test" },
    update: {
      canonicalName: "Atlantic Steel & Fabrication Ltd (Smoke Test)",
      profileStatus: ProfileStatusEnum.PUBLISHED,
    },
    create: {
      id: "supp_smoke_steel_1",
      canonicalName: "Atlantic Steel & Fabrication Ltd (Smoke Test)",
      slug: "atlantic-steel-smoke-test",
      normalizedDomain: "atlanticsteelsmoke.ca",
      websiteUrl: "https://atlanticsteelsmoke.ca",
      profileStatus: ProfileStatusEnum.PUBLISHED,
      claimStatus: ClaimStatusEnum.UNCLAIMED,
      verificationStatus: VerificationStatusEnum.VERIFIED,
      description: "Leading Atlantic Canadian industrial fabricator specializing in structural steel beams, heavy welding, and custom plate metal work for regional buyers.",
      yearFounded: 1998,
    },
  });

  await db.contact.upsert({
    where: { id: "contact_smoke_steel_1" },
    update: {
      publicBusinessEmail: email1,
    },
    create: {
      id: "contact_smoke_steel_1",
      supplierCompanyId: supp1.id,
      name: "Dave Product Manager",
      publicBusinessEmail: email1,
      publicBusinessPhone: "506-555-0199",
      contactType: "SALES",
      provenanceType: "VERIFIED",
      verificationState: "VERIFIED",
    },
  });

  // Capability 1: Steel Fabrication
  const cap1 = await db.capability.upsert({
    where: { slug: "structural-steel-metal-fabrication" },
    update: {
      canonicalName: "Structural Steel & Metal Fabrication",
    },
    create: {
      id: "cap_steel_fab",
      canonicalName: "Structural Steel & Metal Fabrication",
      slug: "structural-steel-metal-fabrication",
      description: "Custom plate work, structural steel beams, heavy weldments, and industrial fabrication.",
    },
  });

  await db.supplierCapability.upsert({
    where: {
      supplierCompanyId_capabilityId: {
        supplierCompanyId: supp1.id,
        capabilityId: cap1.id,
      },
    },
    update: {
      published: true,
      verificationState: VerificationStateEnum.HUMAN_APPROVED,
    },
    create: {
      id: "supp_cap_steel_1",
      supplierCompanyId: supp1.id,
      capabilityId: cap1.id,
      published: true,
      provenanceType: "VERIFIED",
      verificationState: VerificationStateEnum.HUMAN_APPROVED,
    },
  });

  // Supplier 2: Industrial Piping & Valves
  const supp2 = await db.supplierCompany.upsert({
    where: { slug: "maritime-piping-smoke-test" },
    update: {
      canonicalName: "Maritime Industrial Piping Ltd (Smoke Test)",
      profileStatus: ProfileStatusEnum.PUBLISHED,
    },
    create: {
      id: "supp_smoke_piping_2",
      canonicalName: "Maritime Industrial Piping Ltd (Smoke Test)",
      slug: "maritime-piping-smoke-test",
      normalizedDomain: "maritimepipingsmoke.ca",
      websiteUrl: "https://maritimepipingsmoke.ca",
      profileStatus: ProfileStatusEnum.PUBLISHED,
      claimStatus: ClaimStatusEnum.UNCLAIMED,
      verificationStatus: VerificationStatusEnum.VERIFIED,
      description: "Specialized Atlantic Canadian distributor and service provider for high-pressure industrial piping, valves, and flow control systems.",
      yearFounded: 2005,
    },
  });

  await db.contact.upsert({
    where: { id: "contact_smoke_piping_2" },
    update: {
      publicBusinessEmail: email2,
    },
    create: {
      id: "contact_smoke_piping_2",
      supplierCompanyId: supp2.id,
      name: "Sarah Sales Director",
      publicBusinessEmail: email2,
      publicBusinessPhone: "506-555-0288",
      contactType: "SALES",
      provenanceType: "VERIFIED",
      verificationState: "VERIFIED",
    },
  });

  // Capability 2: Piping & Valves
  const cap2 = await db.capability.upsert({
    where: { slug: "industrial-piping-high-pressure-valves" },
    update: {
      canonicalName: "Industrial Piping & High Pressure Valves",
    },
    create: {
      id: "cap_piping_valves",
      canonicalName: "Industrial Piping & High Pressure Valves",
      slug: "industrial-piping-high-pressure-valves",
      description: "Distribution and fabrication of high-pressure stainless piping, flanged valves, and fluid control systems.",
    },
  });

  await db.supplierCapability.upsert({
    where: {
      supplierCompanyId_capabilityId: {
        supplierCompanyId: supp2.id,
        capabilityId: cap2.id,
      },
    },
    update: {
      published: true,
      verificationState: VerificationStateEnum.HUMAN_APPROVED,
    },
    create: {
      id: "supp_cap_piping_2",
      supplierCompanyId: supp2.id,
      capabilityId: cap2.id,
      published: true,
      provenanceType: "VERIFIED",
      verificationState: VerificationStateEnum.HUMAN_APPROVED,
    },
  });

  console.log(`[SUPPLIER 1] Published Supplier: ${supp1.canonicalName} (${supp1.slug})`);
  console.log(`            Configured Contact Email: ${email1}`);
  console.log(`[SUPPLIER 2] Published Supplier: ${supp2.canonicalName} (${supp2.slug})`);
  console.log(`            Configured Contact Email: ${email2}`);
  console.log("\n=== SMOKE-TEST SEED COMPLETED SUCCESSFULLY ===");
}

if (require.main === module) {
  runSmokeTestSeed()
    .then(async () => {
      await db.$disconnect();
    })
    .catch(async (e) => {
      console.error("Smoke test seed failed:", e);
      await db.$disconnect();
      process.exit(1);
    });
}
