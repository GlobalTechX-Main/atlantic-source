import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";

export class JsonLdExtractor implements BaseExtractor {
  public name = "JSON_LD_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];

    for (const scriptContent of input.jsonLdScripts) {
      try {
        const parsed = JSON.parse(scriptContent);
        const objects = Array.isArray(parsed) ? parsed : [parsed];

        for (const obj of objects) {
          if (!obj || typeof obj !== "object") continue;

          const type = obj["@type"];
          if (!type) continue;

          const typeStr = Array.isArray(type) ? type.join(",") : String(type);

          if (
            typeStr.includes("Organization") ||
            typeStr.includes("Corporation") ||
            typeStr.includes("LocalBusiness")
          ) {
            // Email from JSON-LD
            if (obj.email && typeof obj.email === "string") {
              claims.push({
                claimType: "CONTACT",
                rawValue: obj.email.trim(),
                normalizedValue: obj.email.trim().toLowerCase(),
                evidenceText: `JSON-LD ${typeStr} email property`,
                evidenceLocator: "script[type='application/ld+json']",
                extractionMethod: ExtractionMethodEnum.JSON_LD,
                confidence: 0.95,
              });
            }

            // Telephone from JSON-LD
            if (obj.telephone && typeof obj.telephone === "string") {
              claims.push({
                claimType: "CONTACT",
                rawValue: obj.telephone.trim(),
                evidenceText: `JSON-LD ${typeStr} telephone property`,
                evidenceLocator: "script[type='application/ld+json']",
                extractionMethod: ExtractionMethodEnum.JSON_LD,
                confidence: 0.95,
              });
            }

            // Address from JSON-LD
            if (obj.address && typeof obj.address === "object") {
              const addr = obj.address;
              const formattedAddr = [
                addr.streetAddress,
                addr.addressLocality,
                addr.addressRegion,
                addr.postalCode,
                addr.addressCountry,
              ]
                .filter(Boolean)
                .join(", ");

              if (formattedAddr) {
                claims.push({
                  claimType: "LOCATION",
                  rawValue: formattedAddr,
                  evidenceText: `JSON-LD ${typeStr} address property`,
                  evidenceLocator: "script[type='application/ld+json']",
                  extractionMethod: ExtractionMethodEnum.JSON_LD,
                  confidence: 0.95,
                });
              }
            }
          }
        }
      } catch {
        // Ignore invalid JSON-LD
      }
    }

    return claims;
  }
}
