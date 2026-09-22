import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";
import { db } from "@/lib/db";

const FALLBACK_CERTIFICATIONS = [
  { id: "cert_cwb", canonicalName: "CWB W47.1 Certification", slug: "cwb-w47-1" },
  { id: "cert_iso", canonicalName: "ISO 9001 Quality Management", slug: "iso-9001" },
  { id: "cert_cor", canonicalName: "COR Safety Certification", slug: "cor-safety" },
  { id: "cert_asme", canonicalName: "ASME Pressure Piping / Vessel", slug: "asme-pressure-vessel" },
];

export class CertificationExtractor implements BaseExtractor {
  public name = "CERTIFICATION_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];

    let certifications = FALLBACK_CERTIFICATIONS;
    if (process.env.NODE_ENV !== "test") {
      try {
        const dbCerts = await db.certification.findMany({ where: { active: true } });
        if (dbCerts.length > 0) certifications = dbCerts;
      } catch {
        // Fallback
      }
    }

    const sentences = input.visibleText.split(/(?<=[.!?])\s+/);
    const seenCertIds = new Set<string>();

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      for (const cert of certifications) {
        if (seenCertIds.has(cert.id)) continue;

        if (cert.slug.startsWith("cwb")) {
          // Conservative CWB logic
          const hasExplicitW47 = lowerSentence.includes("w47.1") || lowerSentence.includes("w47-1") || lowerSentence.includes("w47 1");
          const hasCertified = lowerSentence.includes("cwb certified") || lowerSentence.includes("cwb certification");
          const hasOrgMention = lowerSentence.includes("canadian welding bureau");

          if (hasExplicitW47) {
            seenCertIds.add(cert.id);
            claims.push({
              claimType: "CERTIFICATION",
              rawValue: "CWB W47.1 Certification",
              normalizedValue: "cwb-w47-1",
              evidenceText: `Matched certification reference in sentence: "${sentence.trim()}"`,
              evidenceLocator: "body_text",
              extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
              confidence: 0.85,
              entityId: cert.id,
            });
          } else if (hasCertified) {
            seenCertIds.add("cwb-certified");
            claims.push({
              claimType: "CERTIFICATION",
              rawValue: "CWB Certified (Standard Unspecified)",
              normalizedValue: "cwb-certified",
              evidenceText: `Matched certification reference in sentence: "${sentence.trim()}"`,
              evidenceLocator: "body_text",
              extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
              confidence: 0.75,
              entityId: cert.id,
            });
          } else if (hasOrgMention) {
            seenCertIds.add("cwb-organization");
            claims.push({
              claimType: "CERTIFICATION",
              rawValue: "Canadian Welding Bureau (Organization Mention)",
              normalizedValue: "cwb-organization",
              evidenceText: `Matched organization reference in sentence: "${sentence.trim()}"`,
              evidenceLocator: "body_text",
              extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
              confidence: 0.6,
              entityId: cert.id,
            });
          }
        } else {
          const acronym = cert.slug.split("-")[0]?.toUpperCase();
          const matchesCanonical = lowerSentence.includes(cert.canonicalName.toLowerCase());
          const matchesAcronym = acronym && acronym.length >= 3 && lowerSentence.includes(acronym.toLowerCase());

          if (matchesCanonical || matchesAcronym) {
            seenCertIds.add(cert.id);
            claims.push({
              claimType: "CERTIFICATION",
              rawValue: cert.canonicalName,
              normalizedValue: cert.slug,
              evidenceText: `Matched certification reference in sentence: "${sentence.trim()}"`,
              evidenceLocator: "body_text",
              extractionMethod: ExtractionMethodEnum.TAXONOMY_EXACT,
              confidence: 0.8,
              entityId: cert.id,
            });
          }
        }
      }
    }

    return claims;
  }
}
