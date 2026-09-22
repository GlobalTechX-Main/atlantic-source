import { db } from "@/lib/db";
import { ExtractorInput, ExtractedClaimCandidate } from "./types";
import { JsonLdExtractor } from "./extractors/jsonld";
import { ContactExtractor } from "./extractors/contact";
import { AddressExtractor } from "./extractors/address";
import { CapabilityExtractor } from "./extractors/capability";
import { IndustryExtractor } from "./extractors/industry";
import { CertificationExtractor } from "./extractors/certification";
import { EquipmentExtractor } from "./extractors/equipment";
import { ServiceRegionExtractor } from "./extractors/serviceRegion";
import { VerificationStateEnum } from "@prisma/client";

export class ExtractionEngine {
  private extractors = [
    new JsonLdExtractor(),
    new ContactExtractor(),
    new AddressExtractor(),
    new CapabilityExtractor(),
    new IndustryExtractor(),
    new CertificationExtractor(),
    new EquipmentExtractor(),
    new ServiceRegionExtractor(),
  ];

  public async runExtraction(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const allCandidates: ExtractedClaimCandidate[] = [];

    for (const extractor of this.extractors) {
      try {
        const candidates = await extractor.extract(input);
        allCandidates.push(...candidates);
      } catch (err) {
        console.error(`Extractor ${extractor.name} error:`, err);
      }
    }

    // Deduplicate candidates by claimType + rawValue
    const uniqueCandidates: ExtractedClaimCandidate[] = [];
    const seen = new Set<string>();

    for (const cand of allCandidates) {
      const key = `${cand.claimType}:${cand.rawValue.toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCandidates.push(cand);
      }
    }

    // Persist ExtractedClaim records to Database if not in offline test mode
    if (process.env.NODE_ENV !== "test") {
      try {
        for (const cand of uniqueCandidates) {
          await db.extractedClaim.create({
            data: {
              supplierCompanyId: input.supplierCompanyId,
              sourceDocumentId: input.sourceDocumentId,
              claimType: cand.claimType,
              rawValue: cand.rawValue,
              normalizedValue: cand.normalizedValue || null,
              evidenceText: cand.evidenceText,
              evidenceLocator: cand.evidenceLocator || null,
              extractionMethod: cand.extractionMethod,
              confidence: cand.confidence,
              reviewState: VerificationStateEnum.UNREVIEWED,
            },
          });
        }
      } catch (err) {
        console.warn("DB persistence error during extraction engine run:", err);
      }
    }

    return uniqueCandidates;
  }
}
