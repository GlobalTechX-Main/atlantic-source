import 'dotenv/config';
import { db } from '../lib/db';
import { BATCH_2_SUPPLIERS } from './run_batch2_production';
import { consolidateExtractedClaims } from '../lib/validation/consolidation';

async function main() {
  console.log('=== DIAGNOSING CAPABILITY RECALL ON CRAWLED SUPPLIERS ===\n');

  const b2Domains = BATCH_2_SUPPLIERS.map(s => s.domain);
  const suppliers = await db.supplierCompany.findMany({
    where: { normalizedDomain: { in: b2Domains } },
    include: {
      crawlRuns: true,
      sourceDocuments: true,
      extractedClaims: { include: { sourceDocument: true } },
    },
  });

  for (const s of suppliers) {
    const lastRun = s.crawlRuns[s.crawlRuns.length - 1];
    const pagesFetched = lastRun?.pagesFetched || 0;
    if (pagesFetched < 1) continue; // Only inspect crawled suppliers

    const supportingItems = s.extractedClaims.map(c => ({
      id: c.id,
      supplierCompanyId: c.supplierCompanyId,
      claimType: c.claimType,
      rawValue: c.rawValue,
      normalizedValue: c.normalizedValue,
      evidenceText: c.evidenceText,
      confidence: c.confidence,
      extractionMethod: c.extractionMethod,
      reviewState: c.reviewState,
      validationActor: c.validationActor,
      sourceUrl: c.sourceDocument?.sourceUrl || '',
      pageType: c.sourceDocument?.pageType || null,
      supplierCompany: { canonicalName: s.canonicalName },
    }));

    const canonicalFacts = consolidateExtractedClaims(supportingItems);
    const capFacts = canonicalFacts.filter(f => f.claimType === 'CAPABILITY');

    console.log(`Supplier: ${s.canonicalName} (${s.normalizedDomain})`);
    console.log(`  Pages Fetched: ${pagesFetched}`);
    console.log(`  Extracted Capabilities Count: ${capFacts.length}`);
    if (capFacts.length > 0) {
      console.log(`  Capabilities: ${capFacts.map(f => `${f.rawValue} (${f.normalizedValue})`).join(' | ')}`);
    } else {
      console.log(`  NO CAPABILITIES EXTRACTED!`);
      console.log(`  Page Titles: ${s.sourceDocuments.map(d => d.title).filter(Boolean).join(' / ')}`);
      console.log(`  Text Snippets:`);
      s.sourceDocuments.slice(0, 3).forEach((d, i) => {
        console.log(`    Doc [${i+1}] ${d.sourceUrl}: ${(d.extractedText || '').slice(0, 250).replace(/\s+/g, ' ')}...`);
      });
    }
    console.log('---------------------------------------------------\n');
  }

  await db.$disconnect();
}

main().catch(console.error);
