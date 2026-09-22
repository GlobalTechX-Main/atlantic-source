import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../lib/db';
import { BATCH_1_SUPPLIERS } from './run_batch1_production';
import { isUsableRfqEmail, isUsableRfqPhone } from '../lib/contacts/usability';
import { consolidateExtractedClaims } from '../lib/validation/consolidation';

async function auditRebuiltBatch1() {
  const domains = BATCH_1_SUPPLIERS.map(s => s.domain);
  const suppliers = await db.supplierCompany.findMany({
    where: { normalizedDomain: { in: domains } },
    include: {
      crawlRuns: true,
      sourceDocuments: true,
      extractedClaims: { include: { sourceDocument: true } },
      locations: true,
      contacts: true,
    },
  });

  let fullCrawls = 0;
  let partialCrawls = 0;
  let failedCrawls = 0;
  let totalCanonHumanRev = 0;
  let withUsableContact = 0;
  let withCapability = 0;

  const supplierAudits = [];

  console.log('=== AUDITING REBUILT BATCH 1 DATASET (' + suppliers.length + ' SUPPLIERS) ===\n');

  for (const s of suppliers) {
    const lastRun = s.crawlRuns[s.crawlRuns.length - 1];
    const pages = lastRun?.pagesFetched || 0;
    if (pages >= 2) fullCrawls++;
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
      pageType: c.sourceDocument?.pageType || null,
      supplierCompany: { canonicalName: s.canonicalName },
    }));

    const canonicalFacts = consolidateExtractedClaims(supportingItems);
    const humanRev = canonicalFacts.filter(f => f.reviewState === 'HUMAN_REVIEW');
    totalCanonHumanRev += humanRev.length;

    const contactClaims = canonicalFacts.filter(f => f.claimType === 'CONTACT' || f.claimType === 'CONTACT_EMAIL' || f.claimType === 'CONTACT_PHONE');
    let hasUsable = false;
    for (const c of contactClaims) {
      if (c.normalizedValue.includes('@')) {
        const evidence = c.supportingClaims[0]?.evidenceText || "";
        if (isUsableRfqEmail(c.normalizedValue, s.normalizedDomain, evidence).usable) hasUsable = true;
      } else {
        if (isUsableRfqPhone(c.normalizedValue).usable) hasUsable = true;
      }
    }
    if (hasUsable) withUsableContact++;

    const capClaims = canonicalFacts.filter(f => f.claimType === 'CAPABILITY');
    if (capClaims.length > 0) withCapability++;

    supplierAudits.push({
      id: s.id,
      canonicalName: s.canonicalName,
      domain: s.normalizedDomain,
      profileStatus: s.profileStatus,
      verificationStatus: s.verificationStatus,
      pagesFetched: pages,
      crawlStatus: lastRun?.status || 'NO_RUN',
      usableContact: hasUsable,
      capabilityCount: capClaims.length,
      unresolvedHumanReview: humanRev.length,
      locationCount: s.locations.length,
    });

    console.log(`[${s.canonicalName.padEnd(35)}] Pages: ${pages} | UsableContact: ${hasUsable ? 'YES' : 'NO'} | Capability: ${capClaims.length > 0 ? 'YES (' + capClaims.length + ')' : 'NO'} | ReviewWorkload: ${humanRev.length}`);
  }

  const crawlSuccessRate = (((fullCrawls + partialCrawls) / suppliers.length) * 100).toFixed(1);
  const usableContactRate = ((withUsableContact / suppliers.length) * 100).toFixed(1);
  const capabilityCoverageRate = ((withCapability / suppliers.length) * 100).toFixed(1);

  const report = {
    timestamp: new Date().toISOString(),
    totalSuppliers: suppliers.length,
    crawlBreakdown: {
      fullCrawls,
      partialCrawls,
      failedCrawls,
      crawlSuccessRate: `${crawlSuccessRate}%`,
    },
    contactCoverage: {
      withUsableContact,
      usableContactRate: `${usableContactRate}%`,
    },
    capabilityCoverage: {
      withCapability,
      capabilityCoverageRate: `${capabilityCoverageRate}%`,
    },
    reviewWorkload: {
      totalUnresolvedHumanReviewCanonicalFacts: totalCanonHumanRev,
      avgUnresolvedPerSupplier: (totalCanonHumanRev / suppliers.length).toFixed(2),
    },
    publicationReadiness: {
      publishedCount: suppliers.filter(s => s.profileStatus === 'PUBLISHED').length,
      draftCount: suppliers.filter(s => s.profileStatus === 'DRAFT').length,
      unverifiedCount: suppliers.filter(s => s.verificationStatus === 'UNVERIFIED').length,
    },
    suppliers: supplierAudits,
  };

  console.log('\n================ FINAL REBUILT BATCH 1 METRICS ================');
  console.log('Total Rebuilt Suppliers:', report.totalSuppliers);
  console.log('Full Crawls (>= 2 pages):', fullCrawls, `(${((fullCrawls / suppliers.length) * 100).toFixed(1)}%)`);
  console.log('Partial Crawls (1 page):', partialCrawls, `(${((partialCrawls / suppliers.length) * 100).toFixed(1)}%)`);
  console.log('Failed Crawls (0 pages):', failedCrawls, `(${((failedCrawls / suppliers.length) * 100).toFixed(1)}%)`);
  console.log('Crawl Success Rate (Full + Partial):', report.crawlBreakdown.crawlSuccessRate);
  console.log('Usable RFQ Contact Coverage:', withUsableContact, `(${report.contactCoverage.usableContactRate})`);
  console.log('Capability Coverage:', withCapability, `(${report.capabilityCoverage.capabilityCoverageRate})`);
  console.log('Unresolved Human Review Canonical Facts:', totalCanonHumanRev);
  console.log('Average Unresolved Human Review / Supplier:', report.reviewWorkload.avgUnresolvedPerSupplier);
  console.log('Publication Readiness Status breakdown:', report.publicationReadiness);

  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const outputPath = path.join(scratchDir, 'batch1_rebuilt_audit_20260916.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved audit report to ${outputPath}`);

  await db.$disconnect();
}

auditRebuiltBatch1().catch(console.error);
