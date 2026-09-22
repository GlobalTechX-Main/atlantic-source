import dns from "dns";
import { SSRFValidationError } from "@/lib/errors";

const FORBIDDEN_SCHEMES = new Set(["file:", "ftp:", "gopher:", "data:", "javascript:"]);

/**
 * Checks whether an IPv4 address string falls into private, loopback, link-local, or metadata subnets.
 */
export function isForbiddenIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IPv4
  }

  const [p0, p1] = parts as [number, number, number, number];

  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return true;

  // 10.0.0.0/8 (Private RFC 1918)
  if (p0 === 10) return true;

  // 172.16.0.0/12 (Private RFC 1918)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

  // 192.168.0.0/16 (Private RFC 1918)
  if (p0 === 192 && p1 === 168) return true;

  // 169.254.0.0/16 (Link-Local & Cloud Metadata 169.254.169.254)
  if (p0 === 169 && p1 === 254) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;

  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET / Documentation)
  if (p0 === 192 && p1 === 0 && parts[2] === 2) return true;

  // 0.0.0.0/8, 255.255.255.255 (Broadcast / Unspecified)
  if (p0 === 0 || p0 === 255) return true;

  // 224.0.0.0/4 (Multicast)
  if (p0 >= 224 && p0 <= 239) return true;

  return false;
}

/**
 * Checks whether an IPv6 address string falls into loopback, private (fc00::/7), or link-local subnets.
 */
export function isForbiddenIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // ::1 / :: (Loopback / Unspecified)
  if (normalized === "::1" || normalized === "::" || normalized === "0:0:0:0:0:0:0:1") return true;

  // fe80::/10 (Link-Local)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }

  // fc00::/7 (Unique Local Unicast RFC 4193)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // ff00::/8 (Multicast)
  if (normalized.startsWith("ff")) return true;

  // IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1 or ::ffff:10.0.0.1)
  if (normalized.includes("::ffff:")) {
    const ipv4Part = normalized.split("::ffff:")[1];
    if (ipv4Part && isForbiddenIPv4(ipv4Part)) return true;
  }

  return false;
}

export function isForbiddenHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();

  if (
    lower === "localhost" ||
    lower === "0.0.0.0" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".lan") ||
    lower.endsWith(".localhost")
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves hostname via DNS and verifies all resolved IP addresses.
 */
export async function resolveAndValidateDestination(targetUrlStr: string): Promise<{ url: URL; resolvedIPs: string[] }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrlStr);
  } catch {
    throw new SSRFValidationError("Malformed URL format");
  }

  // Scheme validation
  if (FORBIDDEN_SCHEMES.has(parsedUrl.protocol) || (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:")) {
    throw new SSRFValidationError(`Forbidden URL scheme: ${parsedUrl.protocol}`);
  }

  const hostname = parsedUrl.hostname;
  if (isForbiddenHostname(hostname)) {
    throw new SSRFValidationError(`Forbidden hostname: ${hostname}`);
  }

  // If hostname is directly an IP literal
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isForbiddenIPv4(hostname)) {
      throw new SSRFValidationError(`Forbidden destination IP: ${hostname}`);
    }
    return { url: parsedUrl, resolvedIPs: [hostname] };
  }

  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const rawIp = hostname.slice(1, -1);
    if (isForbiddenIPv6(rawIp)) {
      throw new SSRFValidationError(`Forbidden destination IPv6: ${rawIp}`);
    }
    return { url: parsedUrl, resolvedIPs: [rawIp] };
  }

  // DNS Resolution: Primary lookup via OS getaddrinfo (handles local DNS/Windows/mDNS) with transient retries
  const resolvedIPs: string[] = [];

  // Attempt 1: OS getaddrinfo with transient retry
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const lookup = await dns.promises.lookup(hostname, { all: true });
      resolvedIPs.push(...lookup.map((item) => item.address));
      if (resolvedIPs.length > 0) break;
    } catch {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }
  }

  // Attempt 2: Fallback to direct c-ares resolve4 / resolve6 if OS lookup returned no addresses
  if (resolvedIPs.length === 0) {
    try {
      const ipv4s = await dns.promises.resolve4(hostname).catch(() => [] as string[]);
      resolvedIPs.push(...ipv4s);
    } catch {
      // Ignore
    }

    try {
      const ipv6s = await dns.promises.resolve6(hostname).catch(() => [] as string[]);
      resolvedIPs.push(...ipv6s);
    } catch {
      // Ignore
    }
  }

  if (resolvedIPs.length === 0) {
    throw new SSRFValidationError(`DNS resolution failed for hostname: ${hostname}`);
  }

  for (const ip of resolvedIPs) {
    if (ip.includes(".")) {
      if (isForbiddenIPv4(ip)) {
        throw new SSRFValidationError(`Forbidden destination IP resolved: ${ip}`);
      }
    } else if (ip.includes(":")) {
      if (isForbiddenIPv6(ip)) {
        throw new SSRFValidationError(`Forbidden destination IPv6 resolved: ${ip}`);
      }
    }
  }

  return { url: parsedUrl, resolvedIPs };
}
