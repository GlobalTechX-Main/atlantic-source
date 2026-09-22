# AtlanticSource — Security & Threat Model Specification

## 1. Overview
This document specifies the security architecture, threat model, and mitigation controls for **AtlanticSource**. As a B2B marketplace handling supplier intelligence, private RFQ communications, and automated web crawling, AtlanticSource enforces strict defense-in-depth principles across network safety, data privacy, access control, and web security.

---

## 2. Threat Analysis & Defensive Control Matrix

### 2.1 Server-Side Request Forgery (SSRF) & Network Crawling Threats

#### Threat 1: SSRF via Target Supplier URLs
- **Attack Scenario**: An attacker submits an internal IP address (e.g. `http://168.254.169.254/latest/meta-data/` or `http://127.0.0.1:5432`) as a supplier URL to force the crawler to scan or expose internal cloud services.
- **Mitigation Controls**:
  - **URL Protocol Validation**: Restrict allowed schemes exclusively to `http://` and `https://`. Reject `file://`, `gopher://`, `ftp://`, `dict://`.
  - **IP Blacklisting & Parsing**: Prior to request dispatch, resolve domain name using node `dns.resolve4` and `dns.resolve6`. Check resolved IPs against forbidden IP ranges:
    - Loopback: `127.0.0.0/8`, `::1`
    - Private IPv4 (RFC 1918): `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
    - Link-Local / AWS Metadata: `169.254.0.0/16`, `fe80::/10`
    - Unique Local IPv6 (RFC 4193): `fc00::/7`
    - Documentation / Carrier Grade NAT: `100.64.0.0/10`, `192.0.2.0/24`
  - **Socket Binding**: Connect directly to verified IP rather than re-resolving hostname at request time.

#### Threat 2: DNS Rebinding
- **Attack Scenario**: A malicious domain resolves to a safe public IP during DNS pre-check, but returns `127.0.0.1` during actual HTTP request fetch (short TTL attack).
- **Mitigation Controls**:
  - **Pinned IP Connection**: The HTTP client agent is configured to connect directly to the pre-validated IP address while setting the original hostname in the HTTP `Host` header.
  - **Short Timeout Window**: Maximum socket setup timeout capped at 5 seconds.

#### Threat 3: Malicious Redirects & Infinite Loops
- **Attack Scenario**: Target server responds with HTTP `302/307` redirecting to an internal IP address or forming a cyclic redirect loop to cause Denial of Service (DoS).
- **Mitigation Controls**:
  - Disable automatic client redirect following.
  - Intercept redirect locations manually; re-run full SSRF validation and IP blacklist checks on every redirect target URL.
  - Enforce maximum redirect depth of 3 hops.

#### Threat 4: Crawler Abuse & Target DoS
- **Attack Scenario**: AtlanticSource crawler floods a small regional business site, causing resource exhaustion or IP banning.
- **Mitigation Controls**:
  - Respect `robots.txt` disallow paths.
  - Enforce strict per-domain rate limiting (minimum 2.0 second delay between requests to same domain).
  - Enforce strict size limits (5 MB max per HTTP response payload).
  - Identification header: `User-Agent: AtlanticSourceBot/1.0 (+https://atlanticsource.ca/bot)`.

---

### 2.2 Input Sanitization, HTML Parsing & XSS

#### Threat 5: Malicious HTML Payload Injection
- **Attack Scenario**: Crawled supplier pages contain malicious HTML, embedded JavaScript (`<script>`, `onload=`, `javascript:` URIs), or hidden CSS designed to compromise admin review consoles or public buyer browsers.
- **Mitigation Controls**:
  - **DOM Sanitization**: HTML content passed to extraction modules or rendering UI must be sanitized using `DOMPurify` (or `sanitize-html`) before parsing or display.
  - **Text Node Extraction**: Extraction engines parse pure DOM text nodes via Cheerio / HTML parser; raw HTML strings are never evaluated or dynamically executed.
  - **Content Security Policy (CSP)**: Strict CSP response headers blocking inline script execution (`script-src 'self'`).

#### Threat 6: Cross-Site Scripting (XSS) in Supplier Profiles & RFQs
- **Attack Scenario**: Malicious user inputs XSS payloads into Supplier Description, RFQ title, or Quote message fields.
- **Mitigation Controls**:
  - React automatic text escaping for all rendered variables.
  - Explicit Zod schema validation stripping dangerous tags from user string inputs.
  - CSP Headers:
    ```
    Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-...'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self';
    ```

---

### 2.3 Web Application & Access Control Threats

#### Threat 7: Cross-Site Request Forgery (CSRF)
- **Mitigation Controls**:
  - Next.js Server Actions automatically enforce origin and CSRF verification.
  - Auth.js cookies set with `SameSite=Lax` (or `SameSite=Strict`), `HttpOnly=true`, and `Secure=true`.

#### Threat 8: SQL Injection
- **Mitigation Controls**:
  - Prisma ORM generates parameterized SQL queries natively.
  - Raw SQL queries (used for `pg_trgm` or full-text search) MUST use Prisma's `Prisma.sql` tagged template literals to ensure complete parameterization.

#### Threat 9: Insecure Direct Object Reference (IDOR) & Multi-Tenant Data Leakage
- **Attack Scenario**: Buyer A changes URL parameters (`/api/rfq/rfq_123`) to view or modify RFQs belonging to Buyer B.
- **Mitigation Controls**:
  - Centralized server-side authorization check on every query and mutation:
    ```typescript
    const rfq = await db.sourcingRequest.findFirst({
      where: { id: rfqId, buyerOrgId: userSession.orgId }
    });
    if (!rfq) throw new ForbiddenError("Access denied");
    ```
  - Authorization guards never trust client-supplied Organization IDs or User Roles.

#### Threat 10: Supplier Profile Takeover
- **Attack Scenario**: Attacker attempts to claim an legitimate supplier profile (`Saint John Steel Fabrication`) to intercept RFQs.
- **Mitigation Controls**:
  - **Automatic Domain Matching**: Instant automated claim approval requires business email address (`user@saintjohnsteel.com`) whose domain matches profile website domain (`saintjohnsteel.com`).
  - **Admin Escalation Queue**: Discrepant domains (e.g. `@gmail.com` or parent company domains) require official documentation upload (business license/utility bill) and manual `SYSTEM_ADMIN` review.
  - **Notification**: Existing company email addresses are notified whenever a claim request is initiated.

#### Threat 11: Email Token Replay & Single-Use Authorization
- **Attack Scenario**: Supplier outreach email token (`/rfq/response?token=abc...`) is forwarded, intercepted, or replayed repeatedly to modify quotes after deadline.
- **Mitigation Controls**:
  - Tokens generated using CSPRNG (`crypto.randomBytes(32)`).
  - Tokens stored as SHA-256 hashes in database (`tokenHash`), expiring after set period (e.g., 14 days or RFQ deadline).
  - Submitting a final response (`INTERESTED`, `DECLINE`) invalidates or locks token state to prevent unauthorized modifications.

---

### 2.4 Data Protection & Infrastructure Threats

#### Threat 12: RFQ Spam & Buyer Misuse
- **Mitigation Controls**:
  - Rate limiting RFQ dispatches per buyer organization (max 10 RFQs per day for unverified buyer accounts).
  - Admin visibility into all outbound buyer RFQs to detect platform abuse.

#### Threat 13: Attachment Attacks & Malicious Uploads
- **Attack Scenario**: Attacker uploads executable malware (`.exe`, `.php`, `.js`) or SVG files containing scripts as RFQ attachments.
- **Mitigation Controls**:
  - Strict file MIME type whitelist: `.pdf`, `.docx`, `.xlsx`, `.png`, `.jpg`, `.csv`, `.dwg`. SVG files explicitly disallowed due to embedded script risks.
  - Max file size limit: 15 MB per attachment.
  - Stored in private S3 bucket with non-executable content headers (`Content-Disposition: attachment`).
  - File access served strictly via short-lived signed URLs (15-minute expiration).

#### Threat 14: Secrets Leakage & Environment Hygiene
- **Mitigation Controls**:
  - Environment variables validated via Zod schema (`src/lib/env.ts`) on startup. App fails fast if required secrets are missing.
  - Sensitivity redacting configured in Pino logger for headers (`Authorization`, `Cookie`) and secret parameters.
  - Pre-commit hooks and `.gitignore` preventing `.env` or credential files from entering git history.

#### Threat 15: PII Overcollection & Compliance
- **Mitigation Controls**:
  - Only collect necessary business context: Name, Business Email, Work Phone, Business Address, Organization Name.
  - Avoid collecting personal financial data or home addresses.

#### Threat 16: Stale Public Information
- **Mitigation Controls**:
  - Published profiles display `lastCrawledAt` and `lastVerifiedAt` timestamps transparently to buyers.
  - Admin audit trails track date of last manual review.
