import { parseSocialLink, SocialPlatform } from "@/lib/extraction/extractors/social";
import { serviceKey } from "@/lib/extraction/extractors/listedService";

export interface PublishedClaimRow {
  claimType: string;
  rawValue: string;
  sourceUrl?: string | null;
}

export interface ListedServices {
  names: string[];
  /** The pages the names came from, for the source line under the list. */
  sources: string[];
}

/** Word-order-free key: "Commercial/Industrial Doors" and "Industrial / Commercial Doors" match. */
function displayKey(name: string): string {
  return serviceKey(name).split(" ").filter(Boolean).sort().join(" ");
}

/** One entry per service (spelling variants merged), in the order the site lists them. */
export function summariseListedServices(
  rows: PublishedClaimRow[],
  limit = 60,
  claimType: "SERVICE_LISTED" | "PRODUCT_LISTED" | "CERTIFICATION_LISTED" = "SERVICE_LISTED",
  /** Names already shown in another list (e.g. products), left out of this one. */
  exclude: string[] = []
): ListedServices {
  const excluded = new Set(exclude.map(displayKey));
  const names: string[] = [];
  const seen = new Set<string>();
  const sources: string[] = [];
  for (const r of rows) {
    if (r.claimType !== claimType) continue;
    const k = displayKey(r.rawValue);
    if (seen.has(k) || excluded.has(k)) continue;
    seen.add(k);
    if (names.length < limit) names.push(r.rawValue);
    if (r.sourceUrl && !sources.includes(r.sourceUrl) && sources.length < 3) sources.push(r.sourceUrl);
  }
  return { names, sources };
}

export interface SocialProfileLink {
  platform: SocialPlatform;
  label: string;
  url: string;
}

const LABELS: Record<SocialPlatform, string> = {
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  X: "X (Twitter)",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
};
const ORDER: SocialPlatform[] = ["LINKEDIN", "FACEBOOK", "INSTAGRAM", "X", "YOUTUBE", "TIKTOK"];

/**
 * One link per platform. When a site links several pages on one platform, the one it
 * links from the most pages (usually the footer) is the company's own.
 */
export function pickSocialLinks(rows: PublishedClaimRow[]): SocialProfileLink[] {
  const counts = new Map<string, { platform: SocialPlatform; url: string; n: number }>();
  for (const r of rows) {
    if (r.claimType !== "SOCIAL") continue;
    const parsed = parseSocialLink(r.rawValue);
    if (!parsed) continue;
    const k = parsed.url.toLowerCase();
    const prev = counts.get(k);
    counts.set(k, { platform: parsed.platform, url: parsed.url, n: (prev?.n ?? 0) + 1 });
  }
  const best = new Map<SocialPlatform, { url: string; n: number }>();
  for (const v of counts.values()) {
    const cur = best.get(v.platform);
    if (!cur || v.n > cur.n) best.set(v.platform, { url: v.url, n: v.n });
  }
  return ORDER.filter((p) => best.has(p)).map((p) => ({ platform: p, label: LABELS[p], url: best.get(p)!.url }));
}

/** Department addresses (sales@, info@, estimating@) are shown publicly; named people's are not. */
export function isPublicContactType(contactType: string): boolean {
  return contactType !== "INDIVIDUAL_BUSINESS_CONTACT" && contactType !== "OTHER";
}

/** Primary first, then backups, then the other contacts, each in their saved order. */
export function contactOrder(name: string | null | undefined): number {
  if (!name) return 99;
  if (name.startsWith("Primary")) return 0;
  const backup = /^Backup RFQ Contact (\d+)/.exec(name);
  if (backup) return Number(backup[1]);
  const other = /^Other Contact (\d+)/.exec(name);
  if (other) return 10 + Number(other[1]);
  return 50;
}

/** Opening hours lines as written on the site, duplicates removed. */
export function summariseHours(rows: PublishedClaimRow[], limit = 4): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.claimType !== "BUSINESS_HOURS") continue;
    const k = r.rawValue.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r.rawValue);
    if (out.length >= limit) break;
  }
  return out;
}
