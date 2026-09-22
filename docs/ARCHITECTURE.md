# AtlanticSource — System Architecture Specification

## 1. Executive Overview
AtlanticSource is a B2B supplier-intelligence and sourcing platform for Atlantic Canada (initial market validation: New Brunswick — Fredericton, Saint John, Moncton). It collects public web data from regional suppliers, extracts structured capabilities using deterministic parsers, establishes verifiable source evidence/provenance, submits extractions to human admin review, and serves a high-trust sourcing marketplace for regional buyers.

### Architectural Philosophy
- **Deterministic First**: MVP relies 100% on explicit CSS/XPath rules, keyword indexes, regex pattern matchers, and verified domain logic. **No AI or LLM components are in the MVP runtime.**
- **High Data Integrity & Provenance**: No supplier claim is published without raw HTML snapshots, precise DOM selectors/text offsets, and human-in-the-loop admin approval.
- **Monolithic Simplicity**: Single Next.js App Router repository, single PostgreSQL database, single background worker process, and single S3-compatible object store. No microservices, Redis, Kafka, or vector databases.

---

## 2. Technical Stack & Standards

| Component | Technology | Version / Specification |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | Latest Stable (React 19 / Server Components) |
| **Language** | TypeScript | Strict Mode (`strict: true`, `noImplicitAny`, etc.) |
| **Database** | PostgreSQL | PostgreSQL 16+ with `pg_trgm` & Full-Text Search (`tsvector`) |
| **ORM** | Prisma ORM | Latest Stable |
| **Authentication** | Auth.js (NextAuth) | WebAuthn / Email Magic Link / Credentials with Argon2id |
| **Styling** | Tailwind CSS | Vanilla CSS variables & accessible primitives |
| **Storage** | S3-Compatible Object Store | MinIO (local) / AWS S3 (prod) for HTML snapshots & RFQ attachments |
| **Background Jobs** | PostgreSQL Queue | Transactional `FOR UPDATE SKIP LOCKED` table |
| **Testing** | Vitest & Playwright | Unit/Integration + End-to-End browser tests |
| **Containerization** | Docker & Compose | Multi-stage Dockerfile + local compose services |

---

## 3. High-Level Architecture Topology

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSERS                                   |
|   (Public Buyers, Supplier Admins, Claimants, System Administrators)             |
+----------------------------------------+------------------------------------------+
                                         | HTTPS (TLS 1.3)
                                         v
+-----------------------------------------------------------------------------------+
|                           NEXT.JS APPLICATION SERVER                              |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | NEXT.JS APP ROUTER (Server Components & Server Actions & API Routes)        |  |
|  | - Authentication & RBAC Middleware                                          |  |
|  | - Security Headers & Rate Limiting                                          |  |
|  | - Public Search & Directory Views                                           |  |
|  | - Buyer RFQ Builder & Sourcing Dashboard                                    |  |
|  | - Supplier Claiming & Profile Manager                                       |  |
|  | - Admin Review & Verification Console                                       |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  | CORE DOMAIN SERVICES                                                        |  |
|  | - Deterministic Extractor Service                                           |  |
|  | - Search & Supplier Matching Engine (PostgreSQL tsvector & pg_trgm)           |  |
|  | - Tokenized Outreach & Email Dispatcher                                     |  |
|  | - Safe Crawler Orchestrator (SSRF-guarded fetch, IP pinning, DOM parser)    |  |
|  +-------------------------------------+---------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
               +-------------------------+-------------------------+
               | Internal DB Connections                           | S3 API
               v                                                   v
+------------------------------------------+    +-----------------------------------+
|               POSTGRESQL                 |    |      OBJECT STORAGE (S3/MinIO)      |
|  - Relational Core Data                  |    |  - Raw HTML Crawl Snapshots       |
|  - Full-Text Search (`tsvector`)         |    |  - RFQ Attachments                |
|  - Fuzzy Search (`pg_trgm`)              |    |  - Verification Documents         |
|  - Transactional Job Queue (`SKIP LOCKED`)|   +-----------------------------------+
+------------------------------------------+
```

---

## 4. Subsystem & Module Specifications

### 4.1 Safe Crawler Subsystem
- **Purpose**: Fetch public website pages from target Atlantic Canada suppliers safely without risk of SSRF, infinite redirect loops, or server exhaustion.
- **Safety Architecture**:
  1. **URL Sanitization & Parsing**: Enforce `http:` and `https:` schemes only. Block private IP ranges (RFC 1918, RFC 4193, loopback `127.0.0.1`, link-local `169.254.169.254`, IPv6 `::1`, and cloud metadata endpoints).
  2. **DNS Resolution & Pinning**: Resolve domain via node `dns.resolve4`/`dns.resolve6` prior to fetch, validate IP against blacklist, and bind connection directly to pinned IP.
  3. **Strict Network Limits**:
     - Max response payload: 5 MB per page.
     - Connect timeout: 5,000 ms; Read timeout: 10,000 ms.
     - Max redirect depth: 3 (each redirect target re-validated through SSRF check).
     - User-Agent header clearly identifying AtlanticSource crawler (`AtlanticSourceBot/1.0 (+https://atlanticsource.ca/bot)`).

### 4.2 Deterministic Extraction & Provenance Engine
- **Purpose**: Parse raw HTML snapshots into structured claims (e.g., service capabilities like "Pipe fabrication", certs like "CWB W47.1", locations like "Saint John, NB").
- **Provenance Data Model**: Every `ExtractedClaim` must store:
  - `pageId`: Link to `CrawlPage` record.
  - `sourceUrl`: Original canonical URL.
  - `rawHtmlHash`: SHA-256 hash of raw HTML payload.
  - `extractedText`: Exact verbatim text snippet matched.
  - `cssSelector` / `xpath`: Location within DOM structure.
  - `characterOffset`: Start and end indices within page text node.
  - `ruleId`: ID of the deterministic rule (e.g., `RULE_STAINLESS_STEEL_KEYWORDS_V1`) that produced the match.
- **Rules Engine**: Standardized regex & CSS selector dictionary mapping terms to standardized categories (e.g. `/(pipe|piping)\s+fab(rication)?/i` $\rightarrow$ `Pipe fabrication`).

### 4.3 Admin Review & Publishing Pipeline
- **States**:
  - `DRAFT` / `UNREVIEWED`: Initial state for newly crawled and extracted supplier profiles.
  - `NEEDS_REVISION`: Admin requested additional verification or corrections.
  - `PUBLISHED`: Admin approved claims; profile visible in buyer search directory.
  - `ARCHIVED`: Profile hidden or deactivated.
- **Workflow**:
  1. Admin inspects extracted claim side-by-side with original text snippet and page preview.
  2. Admin can confirm, edit, reject, or manually add claims.
  3. Audit log entry recorded for every admin action (`actorId`, `actionType`, `timestamp`, `diff`).

### 4.4 Search & Matching Engine
- **Search Technologies**:
  - PostgreSQL `tsvector` and `tsquery` for weighted full-text search across supplier name, description, capabilities, and locations.
  - PostgreSQL `pg_trgm` extension for trigram similarity matching handling typos and partial string matches.
- **Deterministic Supplier Matching**:
  - Filtering by location (Fredericton, Saint John, Moncton, or Province-wide).
  - Filtering by exact category matches (e.g., Structural steel fabrication AND Welding).
  - Scoring formula combining:
    - Exact category capability match weight ($+50$)
    - Exact geographic proximity weight ($+30$)
    - Claimed/Verified supplier status weight ($+20$)
    - Text search rank score (`ts_rank_cd`)

### 4.5 Supplier Claiming & Domain Verification
- **Claim Workflow**:
  1. Unclaimed profile displays "Is this your company? Claim profile".
  2. User inputs business email address (e.g., `john@saintjohnsteel.com`).
  3. **Verification Method A (Email Domain Match)**: If email domain `@saintjohnsteel.com` matches supplier domain `saintjohnsteel.com`, send verification link with single-use cryptographically signed token.
  4. **Verification Method B (Manual Document Review)**: If domain differs (e.g., generic `@gmail.com` or parent company domain), user uploads business registration/utility proof to S3; admin approves manually.
  5. On verification, user receives `SUPPLIER_MEMBER` role linked to `Organization`.

### 4.6 Sourcing Requests (RFQ) & One-Click Email Outreach
- **Buyer Workflow**:
  1. Buyer creates RFQ (title, description, required categories, target geography, deadline, attachments).
  2. Buyer selects target suppliers manually or from match recommendations.
  3. RFQ is submitted.
- **Supplier Outreach**:
  1. Platform dispatches transactional email to each target supplier with unique single-use access token link (`https://atlanticsource.ca/rfq/response?token=<crypto_hash>`).
  2. Supplier clicks link and lands on secure response view without needing immediate password login.
  3. Supplier selects response status:
     - `INTERESTED` (Optional: submit indicative quote amount, lead time, and message/file attachment).
     - `NEED_INFO` (Ask clarifying question).
     - `DECLINE` (Select reason: capacity full, out of scope, location too far).
  4. Responses update buyer's Sourcing Dashboard in real time.

---

## 5. Security & Authorization Architecture

### 5.1 Role-Based Access Control (RBAC)
- **Roles**:
  - `SYSTEM_ADMIN`: Full access to crawler, extraction rules, claim verification, admin console, and system audit logs.
  - `BUYER_MEMBER`: Belong to a Buyer Organization. Can create RFQs, view matched suppliers, track responses, and export reports.
  - `SUPPLIER_MEMBER`: Belong to a Supplier Organization. Can edit claimed profile, view incoming RFQs, and submit quotes/responses.
  - `ANONYMOUS`: Can search published supplier directory and view basic public profiles.

### 5.2 Server-Side Authorization Guard Pattern
All Server Actions and API Routes validate credentials server-side using centralized guards:
```typescript
const session = await requireAuth();
const membership = await requireOrgMember(session.user.id, targetOrgId, ['SUPPLIER_MEMBER']);
```
Client-supplied roles or organization IDs in query params/request bodies are strictly ignored.

---

## 6. Future AI Insertion Boundaries (Abstracted Interfaces)

Although the MVP contains **zero AI**, interface boundaries are pre-defined to accept AI modules in future iterations without refactoring data structures or API routes:

### Boundary 1: `ExtractionProvider` Interface
```typescript
export interface ExtractionProvider {
  extractClaims(input: {
    rawHtml: string;
    text: string;
    url: string;
  }): Promise<ExtractedClaimCandidate[]>;
}

// MVP Implementation (Deterministic)
export class DeterministicRegexExtractor implements ExtractionProvider { ... }

// Future AI Implementation (LLM / Extraction Model)
// export class LLMAssistedExtractor implements ExtractionProvider { ... }
```

### Boundary 2: `SearchFilterParser` Interface
```typescript
export interface SearchFilterParser {
  parseQuery(naturalLanguageQuery: string): Promise<StructuredSearchFilters>;
}

// MVP Implementation (Deterministic Regex & Keyword Parser)
export class DeterministicQueryParser implements SearchFilterParser { ... }

// Future AI Implementation (NL -> Structured SQL/Prisma Filter)
// export class LLMQueryParser implements SearchFilterParser { ... }
```

---

## 7. Deployment Topology & Operations
- **App & API**: Single Next.js container deployed behind TLS terminating reverse proxy (Nginx or Cloudflare).
- **Database**: PostgreSQL 16 managed database instance with automated daily snapshots and WAL archiving.
- **Object Storage**: S3 bucket with private ACLs and signed GET URLs (15-minute expiration) for file downloads.
- **Worker**: Background jobs executed via PostgreSQL `SKIP LOCKED` worker process bundled within the Next.js runtime or as a lightweight companion container.
