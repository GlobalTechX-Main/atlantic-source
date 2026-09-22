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

export const BATCH_2_SUPPLIERS: BatchCandidate[] = [
  { companyName: "Atlantic Controls", websiteUrl: "https://atlanticcontrols.ca", seedCity: "Fredericton", seedProvince: "NB", domain: "atlanticcontrols.ca" },
  { companyName: "Atlantic Machining", websiteUrl: "https://atlanticmachining.ca", seedCity: "Saint John", seedProvince: "NB", domain: "atlanticmachining.ca" },
  { companyName: "East Coast Hydraulics", websiteUrl: "https://eastcoasthydraulics.ca", seedCity: "Moncton", seedProvince: "NB", domain: "eastcoasthydraulics.ca" },
  { companyName: "Wajax Industrial Components", websiteUrl: "https://www.wajax.com", seedCity: "Moncton", seedProvince: "NB", domain: "wajax.com" },
  { companyName: "Crandall Engineering Ltd", websiteUrl: "https://www.crandallengineering.ca", seedCity: "Moncton", seedProvince: "NB", domain: "crandallengineering.ca" },
  { companyName: "EXP Services Inc", websiteUrl: "https://www.exp.com", seedCity: "Fredericton", seedProvince: "NB", domain: "exp.com" },
  { companyName: "Tractor & Equipment Ltd", websiteUrl: "https://www.tractorequipment.com", seedCity: "Fredericton", seedProvince: "NB", domain: "tractorequipment.com" },
  { companyName: "Atlantic Compressed Air", websiteUrl: "https://atlanticcompressedair.ca", seedCity: "Moncton", seedProvince: "NB", domain: "atlanticcompressedair.ca" },
  { companyName: "Maritime Hose & Fittings", websiteUrl: "https://maritimehose.com", seedCity: "Saint John", seedProvince: "NB", domain: "maritimehose.com" },
  { companyName: "Acadian Seaplants Industrial", websiteUrl: "https://acadianseaplants.com", seedCity: "Dartmouth / NB", seedProvince: "NB", domain: "acadianseaplants.com" },
  { companyName: "Sansom Equipment Ltd", websiteUrl: "https://sansom.ca", seedCity: "Fredericton", seedProvince: "NB", domain: "sansom.ca" },
  { companyName: "ALPA Equipment Ltd", websiteUrl: "https://alpaequipment.com", seedCity: "Balmoral", seedProvince: "NB", domain: "alpaequipment.com" },
  { companyName: "Maritime Paper Products", websiteUrl: "https://www.maritimepaper.com", seedCity: "Moncton", seedProvince: "NB", domain: "maritimepaper.com" },
  { companyName: "Brennan Contractors & Engineers Ltd", websiteUrl: "https://www.brennan.ca", seedCity: "Saint John", seedProvince: "NB", domain: "brennan.ca" },
  { companyName: "Atlantic Subsea Inc", websiteUrl: "https://www.atlanticsubsea.ca", seedCity: "Saint John", seedProvince: "NB", domain: "atlanticsubsea.ca" },
  { companyName: "Atlantic Towing Limited", websiteUrl: "https://atlantictowing.com", seedCity: "Saint John", seedProvince: "NB", domain: "atlantictowing.com" },
  { companyName: "Strescon Limited", websiteUrl: "https://www.strescon.com", seedCity: "Saint John", seedProvince: "NB", domain: "strescon.com" },
  { companyName: "Eastern Designers & Company Ltd", websiteUrl: "https://www.easterndesigners.com", seedCity: "Fredericton", seedProvince: "NB", domain: "easterndesigners.com" },
  { companyName: "Lantech Drilling Services", websiteUrl: "https://www.lantechdrilling.com", seedCity: "Dieppe", seedProvince: "NB", domain: "lantechdrilling.com" },
  { companyName: "Atlantic Valves & Controls", websiteUrl: "https://www.atlanticvalves.com", seedCity: "Saint John", seedProvince: "NB", domain: "atlanticvalves.com" },
  { companyName: "Armtec Drainage & Infrastructure", websiteUrl: "https://www.armtec.com", seedCity: "Moncton", seedProvince: "NB", domain: "armtec.com" },
  { companyName: "Stantec Industrial Engineering", websiteUrl: "https://www.stantec.com", seedCity: "Fredericton", seedProvince: "NB", domain: "stantec.com" },
  { companyName: "AECOM Industrial Engineering", websiteUrl: "https://www.aecom.com", seedCity: "Fredericton", seedProvince: "NB", domain: "aecom.com" },
  { companyName: "Englobe Corp Engineering", websiteUrl: "https://www.englobecorp.com", seedCity: "Saint John", seedProvince: "NB", domain: "englobecorp.com" },
  { companyName: "Dillon Consulting Ltd", websiteUrl: "https://www.dillon.ca", seedCity: "Fredericton", seedProvince: "NB", domain: "dillon.ca" },
];

async function getOrCreateSupplier(cand: BatchCandidate) {
  let supp = await db.supplierCompany.findFirst({
    where: {
      OR: [
        { canonicalName: { contains: cand.companyName, mode: 'insensitive' } },
        { normalizedDomain: cand.domain },
      ],
    },
    include: { locations: true },
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

export async function runBatch2() {
  console.log(`=== RUNNING VERIFIED BATCH 2 INGESTION (${BATCH_2_SUPPLIERS.length} SUPPLIERS) ===\n`);

  for (let i = 0; i < BATCH_2_SUPPLIERS.length; i++) {
    const cand = BATCH_2_SUPPLIERS[i];
    if (!cand) continue;
    console.log(`[Batch 2 | ${i + 26}/50] Processing ${cand.companyName} (${cand.domain})...`);

    const supp = await getOrCreateSupplier(cand);

    // Clear previous unreviewed/system claims for clean ingestion, preserving human review decisions
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

  console.log('\nVerified Batch 2 Crawl & Processing Complete!');
  await db.$disconnect();
}

if (require.main === module) {
  runBatch2().catch(console.error);
}
