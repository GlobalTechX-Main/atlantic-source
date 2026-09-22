import 'dotenv/config';
import { db } from '../lib/db';
import { processNextCrawlJob } from '../lib/crawler/worker';

export interface BatchCandidate {
  companyName: string;
  websiteUrl: string;
  seedCity: string;
  seedProvince: string;
  domain: string;
}

export const BATCH_1_SUPPLIERS: BatchCandidate[] = [
  { companyName: "Razor Contract Manufacturing", websiteUrl: "https://razorcontractmfg.ca", seedCity: "Fredericton", seedProvince: "NB", domain: "razorcontractmfg.ca" },
  { companyName: "Coastal Metals Ltd", websiteUrl: "http://coastalmetals.ca", seedCity: "Saint John", seedProvince: "NB", domain: "coastalmetals.ca" },
  { companyName: "Bourque Industrial Ltd", websiteUrl: "https://bourqueindustrial.com", seedCity: "Saint John", seedProvince: "NB", domain: "bourqueindustrial.com" },
  { companyName: "Sunny Corner Enterprises", websiteUrl: "https://sunnycorner.ca", seedCity: "Miramichi", seedProvince: "NB", domain: "sunnycorner.ca" },
  { companyName: "Ocean Steel & Construction", websiteUrl: "https://oceansteel.com", seedCity: "Saint John", seedProvince: "NB", domain: "oceansteel.com" },
  { companyName: "Fundy Engineering", websiteUrl: "https://fundyeng.com", seedCity: "Saint John", seedProvince: "NB", domain: "fundyeng.com" },
  { companyName: "Groupe EMS", websiteUrl: "https://groupeems.ca", seedCity: "Edmundston", seedProvince: "NB", domain: "groupeems.ca" },
  { companyName: "Teklor Controls", websiteUrl: "https://teklorcontrols.com", seedCity: "Moncton", seedProvince: "NB", domain: "teklorcontrols.com" },
  { companyName: "Lite Works", websiteUrl: "https://liteworks.ca", seedCity: "Moncton", seedProvince: "NB", domain: "liteworks.ca" },
  { companyName: "Al's Electric Services", websiteUrl: "https://alselectric.ca", seedCity: "Riverview", seedProvince: "NB", domain: "alselectric.ca" },
  { companyName: "Belanger Electric", websiteUrl: "https://belangerelectric.com", seedCity: "Shediac", seedProvince: "NB", domain: "belangerelectric.com" },
  { companyName: "Brunswick Sheet Metal", websiteUrl: "https://brunswicksheetmetal.com", seedCity: "Dieppe", seedProvince: "NB", domain: "brunswicksheetmetal.com" },
  { companyName: "Lorneville Mechanical Contractors", websiteUrl: "https://www.lorneville.com", seedCity: "Saint John", seedProvince: "NB", domain: "lorneville.com" },
  { companyName: "Apex Industries Inc", websiteUrl: "https://www.apexindustries.com", seedCity: "Moncton", seedProvince: "NB", domain: "apexindustries.com" },
  { companyName: "Source Atlantic", websiteUrl: "https://www.sourceatlantic.ca", seedCity: "Saint John", seedProvince: "NB", domain: "sourceatlantic.ca" },
  { companyName: "Galbraith Construction", websiteUrl: "https://www.galbraithconstruction.ca", seedCity: "Saint John", seedProvince: "NB", domain: "galbraithconstruction.ca" },
  { companyName: "Maritime Hydraulic", websiteUrl: "https://maritimehydraulic.com", seedCity: "Moncton", seedProvince: "NB", domain: "maritimehydraulic.com" },
  { companyName: "Atlantic Hardchrome", websiteUrl: "https://www.atlantichardchrome.com", seedCity: "Moncton", seedProvince: "NB", domain: "atlantichardchrome.com" },
  { companyName: "Acadian Construction", websiteUrl: "https://acadianconstruction.com", seedCity: "Dieppe", seedProvince: "NB", domain: "acadianconstruction.com" },
  { companyName: "Imperial Manufacturing Group", websiteUrl: "https://www.imperialgroup.ca", seedCity: "Richibucto", seedProvince: "NB", domain: "imperialgroup.ca" },
  { companyName: "Black & McDonald Atlantic", websiteUrl: "https://www.blackandmcdonald.com", seedCity: "Moncton", seedProvince: "NB", domain: "blackandmcdonald.com" },
  { companyName: "Universal Truck & Trailer", websiteUrl: "https://universaltruckandtrailer.com", seedCity: "Dieppe", seedProvince: "NB", domain: "universaltruckandtrailer.com" },
  { companyName: "Irving Equipment", websiteUrl: "https://irvingequipment.com", seedCity: "Saint John", seedProvince: "NB", domain: "irvingequipment.com" },
  { companyName: "Guillevin International", websiteUrl: "https://www.guillevin.com", seedCity: "Moncton", seedProvince: "NB", domain: "guillevin.com" },
  { companyName: "Brandt Tractor", websiteUrl: "https://www.brandt.ca", seedCity: "Moncton", seedProvince: "NB", domain: "brandt.ca" }
];

async function getOrCreateSupplier(cand: BatchCandidate) {
  let supp = await db.supplierCompany.findFirst({
    where: {
      OR: [
        { canonicalName: { contains: cand.companyName, mode: 'insensitive' } },
        { normalizedDomain: cand.domain },
      ],
    },
    include: {
      locations: true,
    },
  });

  if (supp) {
    if (supp.normalizedDomain !== cand.domain || supp.canonicalName !== cand.companyName) {
      await db.supplierCompany.update({
        where: { id: supp.id },
        data: { canonicalName: cand.companyName, normalizedDomain: cand.domain, websiteUrl: cand.websiteUrl },
      });
    }
    const seedLoc = supp.locations.find(l => l.provenance === 'PUBLICLY_DISCOVERED') || supp.locations[0];
    if (seedLoc && seedLoc.city !== cand.seedCity) {
      await db.supplierLocation.update({
        where: { id: seedLoc.id },
        data: { city: cand.seedCity, addressLine1: `${cand.seedCity} Location (Seeded)` },
      });
    }
    supp = await db.supplierCompany.findFirst({
      where: { id: supp.id },
      include: { locations: true },
    });
  }

  if (!supp) {
    const slug = cand.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    supp = await db.supplierCompany.create({
      data: {
        canonicalName: cand.companyName,
        slug,
        websiteUrl: cand.websiteUrl,
        normalizedDomain: cand.domain,
        verificationStatus: 'UNVERIFIED',
        claimStatus: 'UNCLAIMED',
        profileStatus: 'DRAFT',
        locations: {
          create: {
            addressLine1: `${cand.seedCity} Location (Seeded)`,
            city: cand.seedCity,
            province: cand.seedProvince,
            country: 'Canada',
            locationType: 'HEADQUARTERS',
            provenance: 'PUBLICLY_DISCOVERED',
          },
        },
      },
      include: { locations: true },
    });
  }

  return supp;
}

export async function runBatch1() {
  console.log(`=== RUNNING VERIFIED BATCH 1 INGESTION (${BATCH_1_SUPPLIERS.length} SUPPLIERS) ===\n`);

  for (let i = 0; i < BATCH_1_SUPPLIERS.length; i++) {
    const cand = BATCH_1_SUPPLIERS[i];
    if (!cand) continue;
    console.log(`[Batch 1 | ${i + 1}/25] Processing ${cand.companyName} (${cand.domain})...`);

    const supp = await getOrCreateSupplier(cand);

    // Clear previous unreviewed/system claims for clean recrawl, preserving existing human review decisions
    await db.extractedClaim.deleteMany({
      where: {
        supplierCompanyId: supp.id,
        reviewedByUserId: null,
        reviewState: {
          notIn: ['HUMAN_APPROVED', 'HUMAN_REJECTED', 'VERIFIED', 'REJECTED']
        }
      }
    });
    await db.sourceDocument.deleteMany({ where: { supplierCompanyId: supp.id } });
    await db.crawlRun.deleteMany({ where: { supplierCompanyId: supp.id } });

    await db.crawlRun.create({
      data: {
        supplierCompanyId: supp.id,
        seedUrl: cand.websiteUrl,
        status: 'PENDING',
        attempts: 0,
        pagesDiscovered: 1,
        pagesFetched: 0,
      },
    });

    try {
      const res = await processNextCrawlJob();
      console.log(`   Finish: ${res.processed ? 'SUCCESS' : 'SKIPPED'}, Pages Fetched: ${res.pagesFetched || 0}, Claims: ${res.claimsGenerated || 0}, Error: ${res.error || 'none'}`);
    } catch (err: unknown) {
      console.log(`   Error processing supplier ${cand.companyName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\nVerified Batch 1 Crawl & Processing Complete!');
  await db.$disconnect();
}

if (require.main === module) {
  runBatch1().catch(console.error);
}
