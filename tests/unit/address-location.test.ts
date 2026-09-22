import { describe, it, expect } from 'vitest';
import { AddressExtractor } from '../../src/lib/extraction/extractors/address';
import { consolidateExtractedClaims, SupportingClaimItem } from '../../src/lib/validation/consolidation';

describe('Location Extraction & Consolidation Integrity', () => {
  it('extracts and preserves distinct locations with correct match offsets', async () => {
    const extractor = new AddressExtractor();
    const wajaxText = `
      Location 1: 200 Urquhart Ave Moncton, NB, E1H 2R5 Equipment Sales
      Location 2: 80 Enterprise Street Moncton, NB, E1E 3P7 Repair Shop
    `;

    const claims = await extractor.extract({
      sourceDocumentId: 'doc-wajax-1',
      supplierCompanyId: 'supp-wajax-1',
      sourceUrl: 'https://www.wajax.com/locations/',
      canonicalUrl: 'https://www.wajax.com/locations/',
      pageTitle: 'Wajax Locations',
      headings: [],
      visibleText: wajaxText,
      mailtoLinks: [],
      telLinks: [],
      jsonLdScripts: [],
    });

    expect(claims.length).toBe(2);
    expect(claims[0]?.rawValue).toContain('200 Urquhart');
    expect(claims[0]?.normalizedValue).toBe('E1H 2R5');

    expect(claims[1]?.rawValue).toContain('80 Enterprise');
    expect(claims[1]?.normalizedValue).toBe('E1E 3P7');
  });

  it('keeps two consecutive addresses with different postal codes as distinct canonical facts', () => {
    const supportingClaims: SupportingClaimItem[] = [
      {
        id: 'claim_loc_1',
        supplierCompanyId: 'supp_wajax',
        claimType: 'LOCATION',
        rawValue: '200 Urquhart Ave Moncton, NB, E1H2R5',
        normalizedValue: 'E1H 2R5',
        evidenceText: 'Extracted address',
        confidence: 0.9,
        extractionMethod: 'ADDRESS_PARSER',
        reviewState: 'AUTO_APPROVED',
        sourceUrl: 'https://www.wajax.com/locations/',
      },
      {
        id: 'claim_loc_2',
        supplierCompanyId: 'supp_wajax',
        claimType: 'LOCATION',
        rawValue: '80 Enterprise Street Moncton, NB, E1E 3P7',
        normalizedValue: 'E1E 3P7',
        evidenceText: 'Extracted address',
        confidence: 0.9,
        extractionMethod: 'ADDRESS_PARSER',
        reviewState: 'AUTO_APPROVED',
        sourceUrl: 'https://www.wajax.com/locations/',
      },
    ];

    const canonicalFacts = consolidateExtractedClaims(supportingClaims);
    expect(canonicalFacts.length).toBe(2);

    const loc1 = canonicalFacts.find((f) => f.rawValue.includes('200 Urquhart'));
    const loc2 = canonicalFacts.find((f) => f.rawValue.includes('80 Enterprise'));

    expect(loc1).toBeDefined();
    expect(loc1?.supportingClaims[0]?.normalizedValue).toBe('E1H 2R5');

    expect(loc2).toBeDefined();
    expect(loc2?.supportingClaims[0]?.normalizedValue).toBe('E1E 3P7');
  });
});
