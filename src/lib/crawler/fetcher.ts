import http from "http";
import https from "https";
import crypto from "crypto";
import { resolveAndValidateDestination } from "./ssrf";
import { SSRFValidationError } from "@/lib/errors";

export interface SafeFetchOptions {
  maxSizeByte?: number; // Default 5 MB (5 * 1024 * 1024)
  timeoutMs?: number;   // Default 10,000 ms
  maxRedirects?: number; // Default 3
  allowedMimeTypes?: string[];
}

export interface FetchResult {
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  mimeType: string;
  content: string;
  contentHash: string;
  sizeBytes: number;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_MAX_REDIRECTS = 6;
const DEFAULT_ALLOWED_MIME_TYPES = ["text/html", "application/xhtml+xml", "text/plain", "application/xml"];
const USER_AGENT = "AtlanticSourceBot/1.0 (+https://atlanticsource.ca/bot)";

export async function safeFetch(
  targetUrl: string,
  options: SafeFetchOptions = {}
): Promise<FetchResult> {
  const maxSize = options.maxSizeByte ?? DEFAULT_MAX_SIZE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const allowedMimes = options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;

  let currentUrl = targetUrl;
  let redirectCount = 0;

  while (true) {
    // 1. SSRF Pre-validation & DNS checks
    let validatedUrl: URL;
    try {
      const res = await resolveAndValidateDestination(currentUrl);
      validatedUrl = res.url;
    } catch (err) {
      if (err instanceof SSRFValidationError && err.message.includes("DNS resolution failed")) {
        const parsed = new URL(currentUrl);
        if (!parsed.hostname.startsWith("www.")) {
          parsed.hostname = `www.${parsed.hostname}`;
        } else {
          parsed.hostname = parsed.hostname.replace(/^www\./, "");
        }
        try {
          const res = await resolveAndValidateDestination(parsed.toString());
          validatedUrl = res.url;
          currentUrl = parsed.toString();
        } catch {
          throw err;
        }
      } else {
        throw err;
      }
    }

    // 2. Fetch payload with manual redirect interception & bounded transient retry
    let result: FetchResult;
    let attempts = 0;
    while (true) {
      attempts++;
      try {
        result = await performSingleRequest(validatedUrl, {
          maxSize,
          timeoutMs,
          allowedMimes,
          userAgent: USER_AGENT,
        });
        break;
      } catch (err: unknown) {
        const errObj = err as { code?: string; message?: string };
        const isTransient =
          errObj &&
          (errObj.code === "ECONNRESET" ||
            errObj.code === "ETIMEDOUT" ||
            errObj.code === "ESOCKETTIMEDOUT" ||
            errObj.code === "ECONNREFUSED" ||
            errObj.message?.includes("socket hang up") ||
            errObj.message?.includes("Request timeout"));
        if (isTransient && attempts < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        throw err;
      }
    }

    // Check for HTTP redirects (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(result.statusCode) && result.headers.location) {
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new SSRFValidationError(`Exceeded max redirect limit of ${maxRedirects}`);
      }
      const redirectTarget = new URL(result.headers.location, currentUrl).toString();
      currentUrl = redirectTarget;
      continue;
    }

    return result;
  }
}

function performSingleRequest(
  url: URL,
  config: {
    maxSize: number;
    timeoutMs: number;
    allowedMimes: string[];
    userAgent: string;
  }
): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;

    const reqOptions: http.RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        "User-Agent": config.userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    };

    const req = transport.request(reqOptions, (res) => {
      const statusCode = res.statusCode || 500;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (v) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
      }

      // Check for Redirects before content type checks
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        return resolve({
          url: url.toString(),
          statusCode,
          headers,
          mimeType: "text/html",
          content: "",
          contentHash: "",
          sizeBytes: 0,
        });
      }

      const contentType = headers["content-type"] || "text/html";
      const mimeType = contentType.split(";")[0]?.trim().toLowerCase() || "text/html";

      const isMimeAllowed = config.allowedMimes.some((m) => mimeType.includes(m));
      if (!isMimeAllowed) {
        req.destroy();
        return reject(new SSRFValidationError(`Forbidden MIME type: ${mimeType}`));
      }

      let sizeBytes = 0;
      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => {
        sizeBytes += chunk.length;
        if (sizeBytes > config.maxSize) {
          req.destroy();
          return reject(new SSRFValidationError(`Response payload exceeded maximum size limit of ${config.maxSize} bytes`));
        }
        chunks.push(chunk);
      });

      res.on("end", () => {
        const bodyBuffer = Buffer.concat(chunks);
        const content = bodyBuffer.toString("utf-8");

        // Calculate SHA-256 hash
        const contentHash = crypto.createHash("sha256").update(bodyBuffer).digest("hex");

        resolve({
          url: url.toString(),
          statusCode,
          headers,
          mimeType,
          content,
          contentHash,
          sizeBytes,
        });
      });

      res.on("error", (err) => {
        reject(err);
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new SSRFValidationError(`Request timeout after ${config.timeoutMs}ms`));
    });

    req.setTimeout(config.timeoutMs);

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}
