import 'dotenv/config';
import { db } from '../lib/db';
import { BATCH_1_SUPPLIERS } from './run_batch1_production';
import { consolidateExtractedClaims } from '../lib/validation/consolidation';
import { isUsableRfqEmail, isUsableRfqPhone } from './reconcile_human_review';

async function auditUsableContacts() {
  const domains = BATCH_1_SUPPLIERS.map(s => s.domain);
  const suppliers = await db.supplierCompany.findMany({
    where: { normalizedDomain: { in: domains } },
    include: {
      crawlRuns: true,
      sourceDocuments: true,
      extractedClaims: { include: { sourceDocument: true } },
    },
  });

  console.log('==============================================================');
  console.log('    SUPPLIER-BY-SUPPLIER USABLE RFQ CONTACT AUDIT (25 SUPPLIERS)');
  console.log('==============================================================\n');

  let anyPublicCount = 0;
  let usableRfqCount = 0;

  const recoveredContactsList: unknown[] = [];

  for (let i = 0; i < BATCH_1_SUPPLIERS.length; i++) {
    const cand = BATCH_1_SUPPLIERS[i];
    if (!cand) continue;
    const supp = suppliers.find(s => s.normalizedDomain === cand.domain);
    if (!supp) continue;

    const supportingItems = supp.extractedClaims.map(c => ({
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
      supplierCompany: { canonicalName: supp.canonicalName },
    }));

    const canonicalFacts = consolidateExtractedClaims(supportingItems);
    const contactFacts = canonicalFacts.filter(f => f.claimType === 'CONTACT');

    const hasAnyPublic = contactFacts.length > 0;
    const usableFacts: string[] = [];
    const excludedFacts: string[] = [];

    for (const fact of contactFacts) {
      const val = fact.normalizedValue || fact.rawValue;
      const isEmail = val.includes('@');
      const firstClaim = fact.supportingClaims[0];

      const usability = isEmail ? isUsableRfqEmail(val) : isUsableRfqPhone(val);

      const contactItem = {
        companyName: supp.canonicalName,
        domain: supp.normalizedDomain,
        rawValue: fact.rawValue,
        normalizedValue: val,
        typeRole: isEmail ? (usability.usable ? 'GENERAL_SALES_EMAIL' : 'DEPARTMENTAL_EXCLUDED') : 'GENERAL_BUSINESS_PHONE',
        sourceUrl: firstClaim?.sourceUrl || supp.websiteUrl,
        extractionMethod: firstClaim?.extractionMethod || 'REGEX_DOM',
        evidenceLocator: firstClaim?.id || 'DOM_BODY',
        isUsableRfq: usability.usable,
        exclusionReason: usability.reason || null,
      };

      recoveredContactsList.push(contactItem);

      if (usability.usable) {
        usableFacts.push(`${isEmail ? 'EMAIL' : 'PHONE'}: ${val}`);
      } else {
        excludedFacts.push(`${isEmail ? 'EMAIL' : 'PHONE'}: ${val} (${usability.reason})`);
      }
    }

    const hasUsableRfq = usableFacts.length > 0;
    if (hasAnyPublic) anyPublicCount++;
    if (hasUsableRfq) usableRfqCount++;

    console.log(`[${i + 1}/25] ${cand.companyName} (${cand.domain}):`);
    console.log(`      Any Public Contact: ${hasAnyPublic ? 'YES' : 'NO'}`);
    console.log(`      Usable RFQ Contact: ${hasUsableRfq ? 'YES' : 'NO'}`);
    if (usableFacts.length > 0) {
      console.log(`      Usable RFQ Channels:`);
      usableFacts.forEach(u => console.log(`        + ${u}`));
    }
    if (excludedFacts.length > 0) {
      console.log(`      Excluded Non-RFQ Channels (Stored in DB with provenance):`);
      excludedFacts.forEach(e => console.log(`        - ${e}`));
    }
    if (!hasAnyPublic) {
      console.log(`      NO CONTACTS EXTRACTED`);
    }
    console.log('');
  }

  console.log('--------------------------------------------------------------');
  console.log(`SUMMARY:`);
  console.log(`  Any Public Contact Coverage:  ${anyPublicCount} / 25 (${((anyPublicCount / 25) * 100).toFixed(1)}%)`);
  console.log(`  Usable RFQ Contact Coverage: ${usableRfqCount} / 25 (${((usableRfqCount / 25) * 100).toFixed(1)}%)`);
  console.log('--------------------------------------------------------------\n');

  await db.$disconnect();
}

auditUsableContacts().catch(console.error);
