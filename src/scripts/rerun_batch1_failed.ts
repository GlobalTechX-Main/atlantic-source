import 'dotenv/config';
import { db } from '../lib/db';
import { processNextCrawlJob } from '../lib/crawler/worker';
import { BATCH_1_SUPPLIERS } from './run_batch1_production';

// The 3 suppliers that already completed successfully
const SUCCESSFUL_DOMAINS = new Set([
  'razorcontractmfg.ca',
  'maritimehydraulic.com',
  'coastalmetals.ca',
]);

export async function rerunFailed22Batch1() {
  const failedCandidates = BATCH_1_SUPPLIERS.filter(s => !SUCCESSFUL_DOMAINS.has(s.domain));

  console.log(`=== RERUNNING INGESTION FOR PREVIOUSLY FAILED 22 BATCH 1 SUPPLIERS ===\n`);
  console.log(`Preserving 3 successful suppliers: Razor Contract Manufacturing, Maritime Hydraulic, Coastal Metals Ltd.\n`);

  for (let i = 0; i < failedCandidates.length; i++) {
    const cand = failedCandidates[i];
    if (!cand) continue;
    console.log(`[Failed Rerun | ${i + 1}/22] Processing ${cand.companyName} (${cand.domain})...`);

    const supp = await db.supplierCompany.findFirst({
      where: { normalizedDomain: cand.domain },
    });

    if (!supp) {
      console.log(`   Supplier company not found for ${cand.domain}, skipping.`);
      continue;
    }

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

  console.log('\n22 Failed Batch 1 Suppliers Rerun Complete!');
  await db.$disconnect();
}

if (require.main === module) {
  rerunFailed22Batch1().catch(console.error);
}
