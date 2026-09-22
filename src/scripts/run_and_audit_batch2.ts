import 'dotenv/config';
import { db } from '../lib/db';
import { BATCH_1_SUPPLIERS } from './run_batch1_production';
import { BATCH_2_SUPPLIERS, runBatch2 } from './run_batch2_production';
import { consolidateExtractedClaims } from '../lib/validation/consolidation';
import { isUsableRfqEmail, isUsableRfqPhone } from '../lib/contacts/usability';

async function main() {
  console.log('=== STARTING BATCH 2 RERUN & AUDIT ===\n');

  // Run Batch 2 crawling & processing
  await runBatch2();

  console.log('\n=== AUDITING BATCH 2 RESULTS ===\n');

  const b1Domains = new Set(BATCH_1_SUPPLIERS.map(s => s.domain.toLowerCase()));
  const b2Domains = BATCH_2_SUPPLIERS.map(s => s.domain.toLowerCase());

  // Check 1: 25 Valid suppliers & 0 Batch 1 duplicates
  const overlaps = b2Domains.filter(d => b1Domains.has(d));
  console.log(`1. Total Batch 2 Candidates Attempted: ${BATCH_2_SUPPLIERS.length}`);
  console.log(`2. Batch 1 Duplicates: ${overlaps.length} (${overlaps.join(', ') || 'None'})`);

  const suppliers = await db.supplierCompany.findMany({
    where: { normalizedDomain: { in: b2Domains } },
    include: {
      crawlRuns: true,
      sourceDocuments: true,
      extractedClaims: { include: { sourceDocument: true } },
      locations: true,
      contacts: true,
    }
  });

  console.log(`3. Verified Database Suppliers Created/Updated: ${suppliers.length}`);

  let fullCrawls = 0;
  let partialCrawls = 0;
  let failedCrawls = 0;
  let totalPages = 0;

  let totalRawClaims = 0;
  let totalCanonicalFacts = 0;
  let totalAutoApproved = 0;
  let totalHumanReview = 0;

  let withUsableEmail = 0;
  let withUsablePhone = 0;
  let withUsableRfqContact = 0;
  let withCapability = 0;
  let withWebsiteLocation = 0;
  let withSeededLocation = 0;

  interface ContactAuditItem {
    company: string;
    domain: string;
    usable: boolean;
    accepted: string[];
    excluded: string[];
  }

  interface LocationAuditItem {
    company: string;
    websiteLocations: string[];
    dbLocations: string[];
  }

  const contactAuditDetails: ContactAuditItem[] = [];
  const locationAuditDetails: LocationAuditItem[] = [];

  for (const s of suppliers) {
    const lastRun = s.crawlRuns[s.crawlRuns.length - 1];
    const pages = lastRun?.pagesFetched || 0;
    totalPages += pages;

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
    totalRawClaims += s.extractedClaims.length;
    totalCanonicalFacts += canonicalFacts.length;

    const autoApp = canonicalFacts.filter(f => f.reviewState === 'APPROVED' || f.reviewState === 'AUTO_APPROVED');
    const humanRev = canonicalFacts.filter(f => f.reviewState === 'HUMAN_REVIEW');

    totalAutoApproved += autoApp.length;
    totalHumanReview += humanRev.length;

    // Contact Evaluation
    const contactClaims = canonicalFacts.filter(f => f.claimType === 'CONTACT' || f.claimType === 'CONTACT_EMAIL' || f.claimType === 'CONTACT_PHONE');
    const dbContacts = s.contacts;

    const allValues = [
      ...contactClaims.map(c => c.normalizedValue || c.rawValue),
      ...dbContacts.map(c => c.publicBusinessEmail || c.publicBusinessPhone || '').filter(Boolean)
    ];

    let hasUsableEmail = false;
    let hasUsablePhone = false;
    const acceptedList: string[] = [];
    const excludedList: string[] = [];

    allValues.forEach(val => {
      const isEmail = val.includes('@');
      if (isEmail) {
        const check = isUsableRfqEmail(val, s.normalizedDomain);
        if (check.usable) {
          hasUsableEmail = true;
          acceptedList.push(`EMAIL: ${val}`);
        } else {
          excludedList.push(`EMAIL: ${val} (${check.reason})`);
        }
      } else {
        const check = isUsableRfqPhone(val);
        if (check.usable) {
          hasUsablePhone = true;
          acceptedList.push(`PHONE: ${val}`);
        } else {
          excludedList.push(`PHONE: ${val} (${check.reason})`);
        }
      }
    });

    const hasUsableRfq = hasUsableEmail || hasUsablePhone;
    if (hasUsableEmail) withUsableEmail++;
    if (hasUsablePhone) withUsablePhone++;
    if (hasUsableRfq) withUsableRfqContact++;

    contactAuditDetails.push({
      company: s.canonicalName,
      domain: s.normalizedDomain || "",
      usable: hasUsableRfq,
      accepted: acceptedList,
      excluded: excludedList,
    });

    // Capability Evaluation
    const capFacts = canonicalFacts.filter(f => f.claimType === 'CAPABILITY');
    if (capFacts.length > 0) withCapability++;

    // Location Evaluation
    const locFacts = canonicalFacts.filter(f => f.claimType === 'LOCATION');
    if (locFacts.length > 0) withWebsiteLocation++;
    if (s.locations.length > 0) withSeededLocation++;

    locationAuditDetails.push({
      company: s.canonicalName,
      websiteLocations: locFacts.map(l => l.normalizedValue),
      dbLocations: s.locations.map(l => `${l.city}, ${l.province} (${l.provenance})`),
    });
  }

  console.log('\n=== CRAWL METRICS ===');
  console.log(`Full Crawls (>=2 pages): ${fullCrawls} (${(fullCrawls / suppliers.length * 100).toFixed(1)}%)`);
  console.log(`Partial Crawls (1 page): ${partialCrawls} (${(partialCrawls / suppliers.length * 100).toFixed(1)}%)`);
  console.log(`Failed Crawls (0 pages): ${failedCrawls} (${(failedCrawls / suppliers.length * 100).toFixed(1)}%)`);
  console.log(`Crawl Success Rate (>=1 page): ${((fullCrawls + partialCrawls) / suppliers.length * 100).toFixed(1)}%`);
  console.log(`Average Pages Fetched per Supplier: ${(totalPages / suppliers.length).toFixed(2)}`);

  console.log('\n=== FACT & REVIEW METRICS ===');
  console.log(`Total Raw Extracted Claims: ${totalRawClaims}`);
  console.log(`Total Consolidated Canonical Facts: ${totalCanonicalFacts}`);
  console.log(`Auto-Approved Facts: ${totalAutoApproved}`);
  console.log(`Unresolved Human-Review Facts: ${totalHumanReview}`);
  console.log(`Exact Denominator: ${suppliers.length}`);
  console.log(`Average Unresolved Human-Review Volume / Supplier: ${(totalHumanReview / suppliers.length).toFixed(2)}`);

  console.log('\n=== COVERAGE METRICS ===');
  console.log(`Suppliers with Usable RFQ Email: ${withUsableEmail} / ${suppliers.length} (${(withUsableEmail / suppliers.length * 100).toFixed(1)}%)`);
  console.log(`Suppliers with Usable RFQ Phone: ${withUsablePhone} / ${suppliers.length} (${(withUsablePhone / suppliers.length * 100).toFixed(1)}%)`);
  console.log(`Usable RFQ Contact Coverage: ${withUsableRfqContact} / ${suppliers.length} (${(withUsableRfqContact / suppliers.length * 100).toFixed(1)}%)`);
  console.log(`Capability Coverage: ${withCapability} / ${suppliers.length} (${(withCapability / suppliers.length * 100).toFixed(1)}%)`);
  console.log(`Website-Extracted Location Coverage: ${withWebsiteLocation} / ${suppliers.length} (${(withWebsiteLocation / suppliers.length * 100).toFixed(1)}%)`);
  console.log(`Seeded Location Coverage: ${withSeededLocation} / ${suppliers.length} (${(withSeededLocation / suppliers.length * 100).toFixed(1)}%)`);

  console.log('\n=== CONTACT QUALITY AUDIT BREAKDOWN ===');
  contactAuditDetails.forEach((c, i) => {
    console.log(`[${i + 1}/25] ${c.company} (${c.domain}) -> Usable: ${c.usable ? 'YES' : 'NO'}`);
    if (c.accepted.length > 0) console.log(`   Accepted: ${c.accepted.join(' | ')}`);
    if (c.excluded.length > 0) console.log(`   Excluded: ${c.excluded.join(' | ')}`);
  });

  await db.$disconnect();
}

main().catch(console.error);
