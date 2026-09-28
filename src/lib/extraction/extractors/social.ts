import { ExtractionMethodEnum } from "@prisma/client";
import { BaseExtractor, ExtractorInput, ExtractedClaimCandidate } from "../types";

export type SocialPlatform = "LINKEDIN" | "FACEBOOK" | "INSTAGRAM" | "X" | "YOUTUBE" | "TIKTOK";

interface PlatformRule {
  platform: SocialPlatform;
  host: RegExp;
  /** Path of a company page (not a share button, post or personal profile). */
  page: RegExp;
}

const RULES: PlatformRule[] = [
  { platform: "LINKEDIN", host: /(^|\.)linkedin\.com$/i, page: /^\/(?:company|school|showcase)\/[^/]+\/?$/i },
  { platform: "FACEBOOK", host: /(^|\.)facebook\.com$|^fb\.com$/i, page: /^\/(?!sharer|share|dialog|plugins|login|groups\/?$|events|watch|hashtag|photo)[A-Za-z0-9.\-_]{2,}\/?$|^\/profile\.php$|^\/p\/[^/]+\/?$/i },
  { platform: "INSTAGRAM", host: /(^|\.)instagram\.com$/i, page: /^\/(?!p\/|reel\/|explore|accounts)[A-Za-z0-9._]{2,}\/?$/i },
  { platform: "X", host: /(^|\.)(?:twitter|x)\.com$/i, page: /^\/(?!intent|share|home|search|hashtag|i\/)[A-Za-z0-9_]{2,}\/?$/i },
  { platform: "YOUTUBE", host: /(^|\.)youtube\.com$/i, page: /^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/?$/i },
  { platform: "TIKTOK", host: /(^|\.)tiktok\.com$/i, page: /^\/@[^/]+\/?$/i },
];

/** Returns the platform and a clean URL when the link is a company's social page. */
export function parseSocialLink(href: string): { platform: SocialPlatform; url: string } | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\.|^[a-z]{2}\./i, "");
  for (const rule of RULES) {
    if (!rule.host.test(host)) continue;
    const path = decodeURIComponent(u.pathname);
    if (!rule.page.test(path)) return null;
    // profile.php?id=… is the only case where the query matters.
    const query = path === "/profile.php" && u.searchParams.get("id") ? `?id=${u.searchParams.get("id")}` : "";
    return { platform: rule.platform, url: `https://www.${host}${path.replace(/\/$/, "")}${query}` };
  }
  return null;
}

export class SocialLinkExtractor implements BaseExtractor {
  public name = "SOCIAL_LINK_EXTRACTOR";

  public async extract(input: ExtractorInput): Promise<ExtractedClaimCandidate[]> {
    const out = new Map<string, ExtractedClaimCandidate>();
    for (const link of input.links || []) {
      const social = parseSocialLink(link.href);
      if (!social || out.has(social.url.toLowerCase())) continue;
      out.set(social.url.toLowerCase(), {
        claimType: "SOCIAL",
        rawValue: social.url,
        normalizedValue: social.url.toLowerCase(),
        evidenceText: `Link on ${input.sourceUrl} to ${social.url}${link.text ? ` ("${link.text.slice(0, 60)}")` : ""}`,
        evidenceLocator: "SOCIAL_LINK",
        extractionMethod: ExtractionMethodEnum.PAGE_STRUCTURE,
        confidence: 0.9,
      });
    }
    return [...out.values()];
  }
}
