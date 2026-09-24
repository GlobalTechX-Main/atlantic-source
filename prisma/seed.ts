import {
  PrismaClient,
  ClaimStatusEnum,
  VerificationStatusEnum,
  ProfileStatusEnum,
  RegionTypeEnum,
  ProvenanceTypeEnum,
  VerificationStateEnum,
  ContactTypeEnum,
} from "@prisma/client";
import { TAXONOMY_CAPABILITIES, TAXONOMY_ALIASES, RETIRED_ALIASES } from "../src/lib/taxonomy/capabilities";

const db = new PrismaClient();

async function main() {
  console.log("Seeding AtlanticSource domain taxonomies & baseline data...");

  // 1. Seed Service Regions
  const atlanticCanada = await db.serviceRegion.upsert({
    where: { slug: "atlantic-canada" },
    update: {},
    create: {
      name: "Atlantic Canada",
      slug: "atlantic-canada",
      regionType: RegionTypeEnum.REGION,
    },
  });

  const newBrunswick = await db.serviceRegion.upsert({
    where: { slug: "new-brunswick" },
    update: {},
    create: {
      name: "New Brunswick",
      slug: "new-brunswick",
      regionType: RegionTypeEnum.PROVINCE,
      parentId: atlanticCanada.id,
    },
  });

  await db.serviceRegion.upsert({
    where: { slug: "nova-scotia" },
    update: {},
    create: {
      name: "Nova Scotia",
      slug: "nova-scotia",
      regionType: RegionTypeEnum.PROVINCE,
      parentId: atlanticCanada.id,
    },
  });

  await db.serviceRegion.upsert({
    where: { slug: "pei" },
    update: {},
    create: {
      name: "Prince Edward Island",
      slug: "pei",
      regionType: RegionTypeEnum.PROVINCE,
      parentId: atlanticCanada.id,
    },
  });

  await db.serviceRegion.upsert({
    where: { slug: "fredericton" },
    update: {},
    create: {
      name: "Fredericton",
      slug: "fredericton",
      regionType: RegionTypeEnum.CITY,
      parentId: newBrunswick.id,
    },
  });

  const saintJohn = await db.serviceRegion.upsert({
    where: { slug: "saint-john" },
    update: {},
    create: {
      name: "Saint John",
      slug: "saint-john",
      regionType: RegionTypeEnum.CITY,
      parentId: newBrunswick.id,
    },
  });

  await db.serviceRegion.upsert({
    where: { slug: "moncton" },
    update: {},
    create: {
      name: "Moncton",
      slug: "moncton",
      regionType: RegionTypeEnum.CITY,
      parentId: newBrunswick.id,
    },
  });

  // 2. Seed Capabilities & Capability Aliases from Canonical Source of Truth
  for (const cap of TAXONOMY_CAPABILITIES) {
    await db.capability.upsert({
      where: { slug: cap.slug },
      update: {
        canonicalName: cap.canonicalName,
        active: true,
      },
      create: {
        id: cap.id,
        canonicalName: cap.canonicalName,
        slug: cap.slug,
        active: true,
      },
    });
  }

  for (const alias of TAXONOMY_ALIASES) {
    await db.capabilityAlias.upsert({
      where: { normalizedAlias: alias.normalizedAlias },
      update: {
        alias: alias.alias,
        capabilityId: alias.capabilityId,
      },
      create: {
        alias: alias.alias,
        capabilityId: alias.capabilityId,
        normalizedAlias: alias.normalizedAlias,
      },
    });
  }

  // Remove aliases that were found to map words to the wrong capability
  await db.capabilityAlias.deleteMany({
    where: { normalizedAlias: { in: Array.from(RETIRED_ALIASES) } },
  });

  const structCap = await db.capability.findUnique({ where: { slug: "structural-steel-fabrication" } });

  // 3. Seed Industries
  const coreIndustries = [
    { name: "Industrial Manufacturing", slug: "industrial-manufacturing" },
    { name: "Marine & Shipbuilding", slug: "marine-shipbuilding" },
    { name: "Mining & Metals", slug: "mining-metals" },
    { name: "Power & Utilities", slug: "power-utilities" },
    { name: "Commercial Construction", slug: "commercial-construction" },
    { name: "Forestry & Pulp/Paper", slug: "forestry-pulp-paper" },
  ];

  for (const ind of coreIndustries) {
    await db.industry.upsert({
      where: { slug: ind.slug },
      update: {},
      create: {
        canonicalName: ind.name,
        slug: ind.slug,
        active: true,
      },
    });
  }

  // 4. Seed Certifications
  const coreCertifications = [
    { name: "CWB W47.1 Certification", slug: "cwb-w47-1", issuingBody: "Canadian Welding Bureau" },
    { name: "ISO 9001 Quality Management", slug: "iso-9001", issuingBody: "International Organization for Standardization" },
    { name: "COR Safety Certification", slug: "cor-safety", issuingBody: "Safety Association" },
    { name: "ASME Pressure Piping / Vessel", slug: "asme-pressure-vessel", issuingBody: "ASME" },
  ];

  for (const cert of coreCertifications) {
    await db.certification.upsert({
      where: { slug: cert.slug },
      update: {},
      create: {
        canonicalName: cert.name,
        slug: cert.slug,
        issuingBody: cert.issuingBody,
        active: true,
      },
    });
  }

  // 5. Seed Equipment Types
  const coreEquipment = [
    { name: "CNC Milling Machine", slug: "cnc-mill" },
    { name: "Hydraulic Press Brake", slug: "hydraulic-press-brake" },
    { name: "CNC Plasma Cutting Table", slug: "cnc-plasma-cutter" },
    { name: "Industrial Lathe", slug: "industrial-lathe" },
  ];

  for (const eq of coreEquipment) {
    await db.equipmentType.upsert({
      where: { slug: eq.slug },
      update: {},
      create: {
        canonicalName: eq.name,
        slug: eq.slug,
        active: true,
      },
    });
  }

  // 6. Seed Platform Admin User
  await db.user.upsert({
    where: { email: "admin@atlanticsource.ca" },
    update: {},
    create: {
      email: "admin@atlanticsource.ca",
      normalizedEmail: "admin@atlanticsource.ca",
      name: "AtlanticSource Admin",
      isPlatformAdmin: true,
    },
  });

  // 7. Seed Sample Supplier (Saint John Industrial Steel)
  const supplierCompany = await db.supplierCompany.upsert({
    where: { slug: "saint-john-industrial-steel" },
    update: {},
    create: {
      canonicalName: "Saint John Industrial Steel & Welding Ltd.",
      legalName: "Saint John Industrial Steel & Welding Ltd.",
      slug: "saint-john-industrial-steel",
      description: "Premier structural steel, stainless steel fabrication, and industrial welding services based in Saint John, New Brunswick.",
      websiteUrl: "https://saintjohnsteel.example.com",
      normalizedDomain: "saintjohnsteel.example.com",
      yearFounded: 1994,
      claimStatus: ClaimStatusEnum.VERIFIED,
      verificationStatus: VerificationStatusEnum.VERIFIED,
      profileStatus: ProfileStatusEnum.PUBLISHED,
      publishedAt: new Date(),
      lastReviewedAt: new Date(),
    },
  });

  // Supplier Location
  await db.supplierLocation.create({
    data: {
      supplierCompanyId: supplierCompany.id,
      addressLine1: "100 Bayside Drive",
      city: "Saint John",
      province: "NB",
      postalCode: "E2J 1A1",
      provenance: ProvenanceTypeEnum.VERIFIED,
      verificationState: VerificationStateEnum.VERIFIED,
    },
  });

  // Supplier Service Region (Saint John + New Brunswick)
  await db.supplierServiceRegion.upsert({
    where: {
      supplierCompanyId_serviceRegionId: {
        supplierCompanyId: supplierCompany.id,
        serviceRegionId: saintJohn.id,
      },
    },
    update: {},
    create: {
      supplierCompanyId: supplierCompany.id,
      serviceRegionId: saintJohn.id,
      provenanceType: ProvenanceTypeEnum.VERIFIED,
      verificationState: VerificationStateEnum.VERIFIED,
    },
  });

  await db.supplierServiceRegion.upsert({
    where: {
      supplierCompanyId_serviceRegionId: {
        supplierCompanyId: supplierCompany.id,
        serviceRegionId: newBrunswick.id,
      },
    },
    update: {},
    create: {
      supplierCompanyId: supplierCompany.id,
      serviceRegionId: newBrunswick.id,
      provenanceType: ProvenanceTypeEnum.VERIFIED,
      verificationState: VerificationStateEnum.VERIFIED,
    },
  });

  // Supplier Capability Link
  if (structCap) {
    await db.supplierCapability.upsert({
      where: {
        supplierCompanyId_capabilityId: {
          supplierCompanyId: supplierCompany.id,
          capabilityId: structCap.id,
        },
      },
      update: {},
      create: {
        supplierCompanyId: supplierCompany.id,
        capabilityId: structCap.id,
        provenanceType: ProvenanceTypeEnum.VERIFIED,
        verificationState: VerificationStateEnum.VERIFIED,
        published: true,
      },
    });
  }

  // Supplier Contact
  await db.contact.create({
    data: {
      supplierCompanyId: supplierCompany.id,
      name: "John Miller",
      title: "General Manager",
      publicBusinessEmail: "john@saintjohnsteel.example.com",
      normalizedEmail: "john@saintjohnsteel.example.com",
      publicBusinessPhone: "506-555-0199",
      contactType: ContactTypeEnum.SALES,
      provenanceType: ProvenanceTypeEnum.VERIFIED,
      verificationState: VerificationStateEnum.VERIFIED,
    },
  });

  console.log("Domain taxonomies and baseline data seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
