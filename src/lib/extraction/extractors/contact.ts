import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";
import { ExtractionMethodEnum } from "@prisma/client";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g;

const PLACEHOLDER_EMAILS = new Set([
  "user@domain.com",
  "name@domain.com",
  "email@domain.com",
  "example@example.com",
  "your.name@company.com",
  "test@test.com",
  "info@company.com",
  "sentry@sentry.io",
]);

export function cleanExtractedEmail(raw: string): string | null {
  let cleaned = raw.replace(/^mailto:/i, "").trim();
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    // Ignore decode error
  }
  cleaned = cleaned.trim().toLowerCase();

  // Strip query parameters (e.g. ?subject=...)
  cleaned = (cleaned.split("?")[0] || "").trim();

  // Strip leading label prefixes like "email", "e-mail:", "contact:", "mail:"
  cleaned = cleaned.replace(/^(email|e-mail|contact|mail|address|to)[:\s-]*/i, "");

  // Strip trailing word suffixes like ".caphone" -> ".ca"
  cleaned = cleaned.replace(/\.(com|ca|org|net|co|io|biz|info|us)(phone|tel|address|fax|call|mobile|contact).*$/i, ".$1");

  if (PLACEHOLDER_EMAILS.has(cleaned)) {
    return null;
  }

  const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (strictEmailRegex.test(cleaned)) {
    return cleaned;
  }
  return null;
}

export function cleanExtractedPhone(raw: string): { rawValue: string; normalizedValue: string } | null {
  const digits = raw.replace(/\D/g, "");
  let norm = "";

  if (digits.length === 10) {
    norm = digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    norm = digits.slice(1);
  } else {
    return null;
  }

  // Reject dummy/fake numbers (repeating digits or sequence)
  if (/^(\d)\1{9}$/.test(norm) || norm === "1234567890" || norm === "0000000026") {
    return null;
  }

  return { rawValue: raw.trim(), normalizedValue: norm };
}

function extractContactsFromJsonLd(
  jsonLdRaw: string,
  seenEmails: Set<string>,
  seenPhones: Set<string>,
  claims: ExtractedClaimCandidate[]
) {
  try {
    const data = JSON.parse(jsonLdRaw);
    const stack = [data];

    while (stack.length > 0) {
      const curr = stack.pop();
      if (!curr || typeof curr !== "object") continue;

      if (Array.isArray(curr)) {
        for (const item of curr) stack.push(item);
        continue;
      }

      for (const [key, val] of Object.entries(curr)) {
        const lowerKey = key.toLowerCase();
        if (typeof val === "string") {
          if (lowerKey.includes("telephone") || lowerKey === "phone") {
            if (lowerKey.includes("fax")) continue;
            const phoneRes = cleanExtractedPhone(val);
            if (phoneRes && !seenPhones.has(phoneRes.normalizedValue)) {
              seenPhones.add(phoneRes.normalizedValue);
              claims.push({
                claimType: "CONTACT",
                rawValue: phoneRes.rawValue,
                normalizedValue: phoneRes.normalizedValue,
                evidenceText: `JSON-LD telephone: "${val.trim()}"`,
                evidenceLocator: "JSON_LD",
                extractionMethod: ExtractionMethodEnum.JSON_LD,
                confidence: 0.95,
              });
            }
          } else if (lowerKey.includes("email")) {
            const cleaned = cleanExtractedEmail(val);
            if (cleaned && !seenEmails.has(cleaned)) {
              seenEmails.add(cleaned);
              claims.push({
                claimType: "CONTACT",
                rawValue: cleaned,
                normalizedValue: cleaned,
                evidenceText: `JSON-LD email: "${val.trim()}"`,
                evidenceLocator: "JSON_LD",
                extractionMethod: ExtractionMethodEnum.JSON_LD,
                confidence: 0.95,
              });
            }
          }
        } else if (typeof val === "object" && val !== null) {
          stack.push(val);
        }
      }
    }
  } catch {
    // Ignore invalid JSON-LD
  }
}

export class ContactExtractor implements BaseExtractor {
  public name = "CONTACT_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const claims: ExtractedClaimCandidate[] = [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    // 1. Process mailto links (MAILTO_HREF)
    for (const rawEmail of input.mailtoLinks) {
      const cleaned = cleanExtractedEmail(rawEmail);
      if (cleaned && !seenEmails.has(cleaned)) {
        seenEmails.add(cleaned);
        claims.push({
          claimType: "CONTACT",
          rawValue: cleaned,
          normalizedValue: cleaned,
          evidenceText: `mailto:${rawEmail}`,
          evidenceLocator: "MAILTO_HREF",
          extractionMethod: ExtractionMethodEnum.CONTACT_PARSER,
          confidence: 0.95,
        });
      }
    }

    // 2. Process tel links (TEL_HREF)
    for (const phone of input.telLinks) {
      const phoneRes = cleanExtractedPhone(phone);
      if (phoneRes && !seenPhones.has(phoneRes.normalizedValue)) {
        seenPhones.add(phoneRes.normalizedValue);
        claims.push({
          claimType: "CONTACT",
          rawValue: phoneRes.rawValue,
          normalizedValue: phoneRes.normalizedValue,
          evidenceText: `tel:${phone}`,
          evidenceLocator: "TEL_HREF",
          extractionMethod: ExtractionMethodEnum.CONTACT_PARSER,
          confidence: 0.95,
        });
      }
    }

    // 3. Process JSON-LD scripts (JSON_LD)
    if (input.jsonLdScripts && input.jsonLdScripts.length > 0) {
      for (const jsonScript of input.jsonLdScripts) {
        extractContactsFromJsonLd(jsonScript, seenEmails, seenPhones, claims);
      }
    }

    // 4. Extract emails from visible text (VISIBLE_TEXT)
    const textMatches = input.visibleText.match(EMAIL_REGEX) || [];
    for (const rawEmail of textMatches) {
      const lower = rawEmail.toLowerCase().trim();
      if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".svg") || lower.endsWith(".js")) {
        continue;
      }

      const cleaned = cleanExtractedEmail(rawEmail);
      if (cleaned && !seenEmails.has(cleaned)) {
        seenEmails.add(cleaned);

        const idx = input.visibleText.indexOf(rawEmail);
        const snippetStart = Math.max(0, idx - 40);
        const snippetEnd = Math.min(input.visibleText.length, idx + rawEmail.length + 40);
        const snippet = input.visibleText.substring(snippetStart, snippetEnd).trim();

        claims.push({
          claimType: "CONTACT",
          rawValue: cleaned,
          normalizedValue: cleaned,
          evidenceText: `Surrounding text: "${snippet}"`,
          evidenceLocator: "VISIBLE_TEXT",
          extractionMethod: ExtractionMethodEnum.CONTACT_PARSER,
          confidence: 0.9,
        });
      }
    }

    // 5. Extract phone numbers from visible text (VISIBLE_TEXT)
    const phoneMatches = input.visibleText.match(PHONE_REGEX) || [];
    for (const phoneStr of phoneMatches) {
      const idx = input.visibleText.indexOf(phoneStr);
      const precedingText = input.visibleText.substring(Math.max(0, idx - 30), idx);
      const surroundingSnippet = input.visibleText.substring(Math.max(0, idx - 40), Math.min(input.visibleText.length, idx + phoneStr.length + 40));

      // Check if phone number is explicitly labeled as Fax (and not overridden by Phone label)
      const lastFaxIdx = precedingText.toLowerCase().lastIndexOf("fax");
      const lastPhoneIdx = Math.max(precedingText.toLowerCase().lastIndexOf("phone"), precedingText.toLowerCase().lastIndexOf("tel"), precedingText.toLowerCase().lastIndexOf("call"));
      const isFax = lastFaxIdx !== -1 && lastFaxIdx > lastPhoneIdx;
      if (isFax) {
        continue; // Skip fax lines as primary business phone
      }

      // Check for third-party or partner phone references in surrounding snippet
      const isThirdParty = /subcontracted|partnered with|our partner|provided by partner|client phone/i.test(surroundingSnippet);
      if (isThirdParty) {
        continue;
      }

      const phoneRes = cleanExtractedPhone(phoneStr);
      if (phoneRes && !seenPhones.has(phoneRes.normalizedValue)) {
        seenPhones.add(phoneRes.normalizedValue);
        claims.push({
          claimType: "CONTACT",
          rawValue: phoneRes.rawValue,
          normalizedValue: phoneRes.normalizedValue,
          evidenceText: `Phone in page text: "${phoneStr.trim()}"`,
          evidenceLocator: "VISIBLE_TEXT",
          extractionMethod: ExtractionMethodEnum.CONTACT_PARSER,
          confidence: 0.85,
        });
      }
    }

    return claims;
  }
}

