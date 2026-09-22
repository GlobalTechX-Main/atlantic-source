import 'dotenv/config';
import { db } from '../lib/db';
import { BATCH_1_SUPPLIERS } from './run_batch1_production';
import { consolidateExtractedClaims } from '../lib/validation/consolidation';

async function printSummary() {
  const domains = BATCH_1_SUPPLIERS.map(s => s.domain);
  const suppliers = await db.supplierCompany.findMany({
    where: { normalizedDomain: { in: domains } },
    include: {
      crawlRuns: true,
      sourceDocuments: true,
      extractedClaims: { include: { sourceDocument: true } },
      locations: true,
    },
  });

  const attemptedCount = BATCH_1_SUPPLIERS.length;
  let successfulCrawls = 0;
  let partialCrawls = 0;
  let failedCrawls = 0;
  let totalPagesFetched = 0;
  let totalRawClaims = 0;
  let totalCanonicalFacts = 0;
  let totalAutoApprovedFacts = 0;
  let totalHumanReviewFacts = 0;
  let suppliersWithEmail = 0;
  let suppliersWithPhone = 0;
  let suppliersWithUsableContact = 0;
  let suppliersWithCapability = 0;
  let suppliersWithExtractedLocation = 0;

  const newlyRecoveredContacts: Record<string, unknown>[] = [];
  const stillMissingContacts: Record<string, unknown>[] = [];
  const autoApprovedContactsForAudit: Record<string, unknown>[] = [];

  for (const s of suppliers) {
    const lastRun = s.crawlRuns[s.crawlRuns.length - 1];
    const pages = lastRun?.pagesFetched || 0;
    totalPagesFetched += pages;

    if (pages >= 2) successfulCrawls++;
    else if (pages === 1) partialCrawls++;
    else failedCrawls++;

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
      supplierCompany: { canonicalName: s.canonicalName },
    }));

    const canonicalFacts = consolidateExtractedClaims(supportingItems);
    totalRawClaims += s.extractedClaims.length;
    totalCanonicalFacts += canonicalFacts.length;

    const autoApp = canonicalFacts.filter(f => f.reviewState === 'APPROVED' || f.reviewState === 'AUTO_APPROVED');
    const humanRev = canonicalFacts.filter(f => f.reviewState === 'HUMAN_REVIEW');

    totalAutoApprovedFacts += autoApp.length;
    totalHumanReviewFacts += humanRev.length;

    const contactFacts = canonicalFacts.filter(f => f.claimType === 'CONTACT' || f.claimType === 'CONTACT_EMAIL' || f.claimType === 'CONTACT_PHONE');
    const emailFacts = contactFacts.filter(f => f.normalizedValue.includes('@') || f.rawValue.includes('@'));
    const phoneFacts = contactFacts.filter(f => !f.normalizedValue.includes('@') && !f.rawValue.includes('@'));

    if (emailFacts.length > 0) suppliersWithEmail++;
    if (phoneFacts.length > 0) suppliersWithPhone++;
    if (contactFacts.length > 0) {
      suppliersWithUsableContact++;
      newlyRecoveredContacts.push({
        company: s.canonicalName,
        domain: s.normalizedDomain,
        emails: emailFacts.map(e => ({ val: e.normalizedValue, methods: e.extractionMethods, snippet: e.supportingClaims[0]?.evidenceText })),
        phones: phoneFacts.map(p => ({ val: p.normalizedValue, methods: p.extractionMethods, snippet: p.supportingClaims[0]?.evidenceText })),
      });
    } else {
      stillMissingContacts.push({ company: s.canonicalName, domain: s.normalizedDomain, crawlStatus: lastRun?.status || 'N/A', pagesFetched: pages });
    }

    const capFacts = canonicalFacts.filter(f => f.claimType === 'CAPABILITY');
    if (capFacts.length > 0) suppliersWithCapability++;

    const locFacts = canonicalFacts.filter(f => f.claimType === 'LOCATION');
    if (locFacts.length > 0) suppliersWithExtractedLocation++;

    autoApp.filter(f => f.claimType === 'CONTACT' || f.claimType === 'CONTACT_EMAIL' || f.claimType === 'CONTACT_PHONE').forEach(f => {
      autoApprovedContactsForAudit.push({
        supplier: s.canonicalName,
        domain: s.normalizedDomain,
        rawValue: f.rawValue,
        normValue: f.normalizedValue,
        extractionMethods: f.extractionMethods,
        evidenceText: f.supportingClaims[0]?.evidenceText,
      });
    });
  }

  const crawlSuccessRate = attemptedCount > 0 ? (((successfulCrawls + partialCrawls) / attemptedCount) * 100) : 0;
  const fullCrawlRate = attemptedCount > 0 ? ((successfulCrawls / attemptedCount) * 100) : 0;
  const avgPagesFetched = attemptedCount > 0 ? (totalPagesFetched / attemptedCount) : 0;
  const avgHumanReviewPerSupplier = attemptedCount > 0 ? (totalHumanReviewFacts / attemptedCount) : 0;
  const contactCoverage = attemptedCount > 0 ? ((suppliersWithUsableContact / attemptedCount) * 100) : 0;
  const capabilityCoverage = attemptedCount > 0 ? ((suppliersWithCapability / attemptedCount) * 100) : 0;

  console.log('=== BATCH 1 AUDITED FINAL CHECKPOINT METRICS ===');
  console.log(`1. Total Suppliers Attempted: ${attemptedCount}`);
  console.log(`2. Verified Live DB Suppliers: ${suppliers.length}`);
  console.log(`3. Full Crawls (>=2 pages): ${successfulCrawls} (${fullCrawlRate.toFixed(1)}%)`);
  console.log(`4. Partial Crawls (1 page): ${partialCrawls} (${((partialCrawls / attemptedCount) * 100).toFixed(1)}%)`);
  console.log(`5. Failed Crawls (0 pages): ${failedCrawls} (${((failedCrawls / attemptedCount) * 100).toFixed(1)}%)`);
  console.log(`6. Overall Crawl Success Rate (Full + Partial): ${crawlSuccessRate.toFixed(1)}%`);
  console.log(`7. Average Pages Fetched / Supplier: ${avgPagesFetched.toFixed(2)}`);
  console.log(`8. Raw Extracted Claims: ${totalRawClaims}`);
  console.log(`9. Canonical Facts: ${totalCanonicalFacts}`);
  console.log(`10. Auto-Approved Canonical Facts: ${totalAutoApprovedFacts}`);
  console.log(`11. Human-Review Canonical Facts: ${totalHumanReviewFacts}`);
  console.log(`12. Average Human-Review Items / Supplier: ${avgHumanReviewPerSupplier.toFixed(2)}`);
  console.log(`13. Suppliers with Email: ${suppliersWithEmail} (${((suppliersWithEmail / attemptedCount) * 100).toFixed(1)}%)`);
  console.log(`14. Suppliers with Phone: ${suppliersWithPhone} (${((suppliersWithPhone / attemptedCount) * 100).toFixed(1)}%)`);
  console.log(`15. Usable Contact Coverage: ${suppliersWithUsableContact} / ${attemptedCount} (${contactCoverage.toFixed(1)}%)`);
  console.log(`16. Capability Coverage: ${suppliersWithCapability} / ${attemptedCount} (${capabilityCoverage.toFixed(1)}%)`);
  console.log(`17. Suppliers with Website Location: ${suppliersWithExtractedLocation}`);

  console.log('\n=== RECOVERED / ACTIVE SUPPLIER CONTACTS (${newlyRecoveredContacts.length}) ===');
  console.log(JSON.stringify(newlyRecoveredContacts, null, 2));

  console.log('\n=== STILL MISSING CONTACTS (${stillMissingContacts.length}) ===');
  console.log(JSON.stringify(stillMissingContacts, null, 2));

  console.log('\n=== ALL AUTO-APPROVED CONTACTS FOR ACCURACY AUDIT (${autoApprovedContactsForAudit.length}) ===');
  console.log(JSON.stringify(autoApprovedContactsForAudit, null, 2));

  await db.$disconnect();
}

printSummary().catch(console.error);
