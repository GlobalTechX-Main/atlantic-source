import 'dotenv/config';
import { db } from '../lib/db';
import { processNextCrawlJob } from '../lib/crawler/worker';

export interface OperationalSupplierCandidate {
  companyName: string;
  websiteUrl: string;
  seedCity: string;
  seedProvince: string;
  domain: string;
}

export const CANDIDATE_SUPPLIERS: OperationalSupplierCandidate[] = [
  { companyName: "Razor Contract Manufacturing", websiteUrl: "https://razorcontractmfg.ca", seedCity: "Fredericton", seedProvince: "NB", domain: "razorcontractmfg.ca" },
  { companyName: "Coastal Metals Ltd", websiteUrl: "http://coastalmetals.ca", seedCity: "Saint John", seedProvince: "NB", domain: "coastalmetals.ca" },
  { companyName: "Bourque Industrial Ltd", websiteUrl: "https://bourqueindustrial.com", seedCity: "Saint John", seedProvince: "NB", domain: "bourqueindustrial.com" },
  { companyName: "Sunny Corner Enterprises", websiteUrl: "https://sunnycorner.ca", seedCity: "Miramichi", seedProvince: "NB", domain: "sunnycorner.ca" },
  { companyName: "Ocean Steel & Construction", websiteUrl: "https://oceansteel.com", seedCity: "Saint John", seedProvince: "NB", domain: "oceansteel.com" },
  { companyName: "Fundy Engineering", websiteUrl: "https://fundyeng.com", seedCity: "Saint John", seedProvince: "NB", domain: "fundyeng.com" },
  { companyName: "Groupe EMS", websiteUrl: "https://groupeems.ca", seedCity: "Edmundston", seedProvince: "NB", domain: "groupeems.ca" },
  { companyName: "Brunswick Sheet Metal", websiteUrl: "https://brunswicksheetmetal.com", seedCity: "Dieppe", seedProvince: "NB", domain: "brunswicksheetmetal.com" },
  { companyName: "Teklor Controls", websiteUrl: "https://teklorcontrols.com", seedCity: "Moncton", seedProvince: "NB", domain: "teklorcontrols.com" },
  { companyName: "Lite Works", websiteUrl: "https://liteworks.ca", seedCity: "Moncton", seedProvince: "NB", domain: "liteworks.ca" },
  { companyName: "Al's Electric Services", websiteUrl: "https://alselectric.ca", seedCity: "Riverview", seedProvince: "NB", domain: "alselectric.ca" },
  { companyName: "Belanger Electric", websiteUrl: "https://belangerelectric.com", seedCity: "Shediac", seedProvince: "NB", domain: "belangerelectric.com" },
  { companyName: "Larry Electric", websiteUrl: "https://larryelectric.ca", seedCity: "Moncton", seedProvince: "NB", domain: "larryelectric.ca" },
  { companyName: "Lorneville Mechanical Contractors", websiteUrl: "https://www.lorneville.com", seedCity: "Saint John", seedProvince: "NB", domain: "lorneville.com" },
  { companyName: "Apex Industries Inc", websiteUrl: "https://www.apexindustries.com", seedCity: "Moncton", seedProvince: "NB", domain: "apexindustries.com" },
  { companyName: "Source Atlantic", websiteUrl: "https://www.sourceatlantic.ca", seedCity: "Saint John", seedProvince: "NB", domain: "sourceatlantic.ca" },
  { companyName: "Galbraith Construction", websiteUrl: "https://www.galbraithconstruction.ca", seedCity: "Saint John", seedProvince: "NB", domain: "galbraithconstruction.ca" },
  { companyName: "McInnes Cooper Industrial", websiteUrl: "https://www.mcinnescooper.com", seedCity: "Moncton", seedProvince: "NB", domain: "mcinnescooper.com" },
  { companyName: "Gulf Operators", websiteUrl: "https://www.gulfoperators.com", seedCity: "Saint John", seedProvince: "NB", domain: "gulfoperators.com" },
  { companyName: "Atlantic Hardchrome", websiteUrl: "https://www.atlantichardchrome.com", seedCity: "Moncton", seedProvince: "NB", domain: "atlantichardchrome.com" },
];

async function getOrCreateSupplier(cand: OperationalSupplierCandidate) {
  let supp = await db.supplierCompany.findFirst({
    where: {
      OR: [
        { canonicalName: { contains: cand.companyName, mode: 'insensitive' } },
        { normalizedDomain: cand.domain },
      ],
    },
    include: {
      crawlRuns: true,
      sourceDocuments: true,
      extractedClaims: { include: { sourceDocument: true } },
      locations: true,
    },
  });

  if (supp) {
    if (supp.normalizedDomain !== cand.domain) {
      await db.supplierCompany.update({
        where: { id: supp.id },
        data: { normalizedDomain: cand.domain },
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
      include: {
        crawlRuns: true,
        sourceDocuments: true,
        extractedClaims: { include: { sourceDocument: true } },
        locations: true,
      },
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
      include: {
        crawlRuns: true,
        sourceDocuments: true,
        extractedClaims: { include: { sourceDocument: true } },
        locations: true,
      },
    });
  }

  return supp;
}

export async function runOperationalIngestion() {
  console.log(`Starting Corrected Operational Ingestion Test for ${CANDIDATE_SUPPLIERS.length} pre-verified suppliers...\n`);

  for (let i = 0; i < CANDIDATE_SUPPLIERS.length; i++) {
    const cand = CANDIDATE_SUPPLIERS[i];
    if (!cand) continue;
    console.log(`[${i + 1}/${CANDIDATE_SUPPLIERS.length}] Processing ${cand.companyName} (${cand.websiteUrl})...`);

    const supp = await getOrCreateSupplier(cand);

    // Clear previous claims and crawls for clean ingestion test
    await db.extractedClaim.deleteMany({ where: { supplierCompanyId: supp.id } });
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

    const res = await processNextCrawlJob();
    console.log(`   Crawl finish: ${res.processed ? 'Processed' : 'Skipped'}, fetched: ${res.pagesFetched || 0}, claims: ${res.claimsGenerated || 0}, error: ${res.error || 'none'}`);
  }

  console.log('\nOperational ingestion crawl phase complete!');
  await db.$disconnect();
}

if (require.main === module) {
  runOperationalIngestion().catch(console.error);
}
