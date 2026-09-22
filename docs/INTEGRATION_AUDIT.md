# AtlanticSource — Integration Audit & Wiring Fix Report

## 1. Executive Summary

This report documents the application-wide integration wiring audit, bug fixes, background worker implementation, and database-backed UI verification performed on **AtlanticSource** (B2B Supplier Intelligence Platform for Atlantic Canada).

All static/mock UI components across the administration console have been replaced with real PostgreSQL Prisma database queries. Server-side RBAC authorization guards and audit log provenance rules have been verified across all mutations.

---

## 2. Known Queue Crawl Bug Analysis & Resolution

### Root Cause
The "Queue Crawl" action on supplier rows in the Admin Supplier Directory (`/admin/suppliers`) was previously an un-wired client element (`<Link href="/admin/crawler">`) that performed page navigation without invoking a server action, validating the supplier website URL, or persisting a `CrawlRun` record to PostgreSQL.

### Resolution
1. Created `queueCrawlRun` in `src/lib/crawler/queue.ts` enforcing:
   - Server-side `platform_admin` RBAC authorization via trusted session context.
   - Validation that the target `SupplierCompany` exists and possesses a valid `http://` or `https://` website URL.
   - Idempotency guard preventing duplicate `PENDING` or `RUNNING` crawl jobs for the same supplier.
   - Creation of a real `CrawlRun` database row in `PENDING` state.
   - Provenance audit logging via `logAdminAction("CRAWL_RUN_QUEUED", "CrawlRun", ...)`.
2. Created Server Action `queueCrawlAction(supplierCompanyId)` in `src/lib/actions/crawler.ts`.
3. Created interactive `QueueCrawlButton` component in `src/app/(admin)/admin/suppliers/SuppliersTable.tsx` providing loading states, inline user feedback, and automatic Next.js router revalidation (`router.refresh()`).

---

## 3. Crawler Background Worker Architecture

### Worker Implementation
AtlanticSource now includes a background worker runner (`src/lib/crawler/worker.ts` and `scripts/worker.ts`) executing PostgreSQL-backed job claiming.

- **CLI Command**: `npm run worker`
- **Execution Architecture**: Polling-based background runner claiming `PENDING` `CrawlRun` records using PostgreSQL transactions.
- **Job Lifecycle**:
  ```text
  PENDING CrawlRun (created by Queue Crawl action)
  ↓ worker claims job (atomic updateMany PENDING → RUNNING)
  RUNNING
  ↓ fetch seed URL & parse HTML (safeFetch + parseAndSanitizeHtml)
  ↓ discover high-value subpages (discoverHighValueLinks)
  ↓ run deterministic extractors (ExtractionEngine)
  ↓ persist SourceDocuments & ExtractedClaims (reviewState = UNREVIEWED)
  COMPLETED (or FAILED with errorSummary)
  ```
- **Concurrency & Safety**: Safe SSRF network protection via `safeFetch()`, max 5MB payload limit, loopback IP blacklist, and execution isolation.

---

## 4. UI-to-Database Wiring & Removal of Mock Data

Every screen in the administration console was audited and re-wired to read real state from PostgreSQL:

| Admin Screen | Path | Audit Findings & Actions Taken | DB Model Wired |
| :--- | :--- | :--- | :--- |
| **Supplier Directory** | `/admin/suppliers` | Form created DRAFT suppliers; wired "Queue Crawl" button with real action and loading UI. | `db.supplierCompany` |
| **Crawler Dashboard** | `/admin/crawler` | Replaced mock array with real database query. Added Retry/Recrawl Server Action (`retryCrawlAction`). | `db.crawlRun` |
| **Extraction Review** | `/admin/review` | Replaced mock array with real `ExtractedClaim` query. Wired Approve, Reject, and Mark Stale server actions. | `db.extractedClaim` |
| **Claim Requests** | `/admin/claims` | Replaced mock array with real `CompanyClaimRequest` query. Wired Approve and Reject actions. | `db.companyClaimRequest` |
| **Taxonomy Manager** | `/admin/taxonomy` | Replaced hardcoded list with real capability & alias counts and creation actions. | `db.capability` & `db.capabilityAlias` |
| **Freshness Audit** | `/admin/freshness` | Replaced mock data with real supplier crawl staleness queries and bulk recrawl action. | `db.supplierCompany` & `db.crawlRun` |
| **Audit Logs** | `/admin/audit` | Replaced mock data with real `AuditLog` history and JSON metadata viewer. | `db.auditLog` |

---

## 5. Summary of Miswirings Fixed

1. **Save Supplier Form**: Wired to `createManualSupplierAction()` with Zod schema validation and server-side `isPlatformAdmin` check.
2. **Admin Auth Local Session**: Resolved local session mismatch by ensuring `getCurrentUserSession()` resolves seeded platform admin credentials.
3. **Queue Crawl Action**: Replaced dummy link with `queueCrawlAction()` and `queueCrawlRun()`.
4. **Extraction Claim Review**: Wired `approveClaimAction()`, `rejectClaimAction()`, and `markClaimStaleAction()` to `src/lib/admin/publishing.ts`.
5. **Company Claim Approval**: Wired `approveCompanyClaimAction()` to grant `SUPPLIER_ADMIN` role upon verification.
6. **Crawler Retry**: Wired `retryCrawlAction()` to reset `FAILED` crawls to `PENDING`.

---

## 6. Automated & Manual Test Results

### Automated Quality Checks
- `npx prisma validate`: **PASS** (0 errors)
- `npx prisma generate`: **PASS** (Client generated)
- `npm run typecheck`: **PASS** (0 TypeScript errors)
- `npm run lint`: **PASS** (0 ESLint warnings/errors)
- `npm run test`: **PASS** (90/90 unit & integration tests passing)
- `npm run build`: **PASS** (Next.js production build succeeded cleanly)

### Manual E2E Flow Verification
1. Created manual supplier ("Halifax Precision Machining") via Admin Supplier Directory → verified creation in DB.
2. Clicked "Queue Crawl" → verified `CrawlRun` created in `PENDING` state.
3. Started `npm run worker` → verified transition `PENDING` → `RUNNING` → `COMPLETED`.
4. Verified `SourceDocument` records created and `ExtractedClaim` records persisted in `UNREVIEWED` state.
5. Visited Extraction Review Queue (`/admin/review`) → clicked "Approve & Publish" → verified `SupplierCapability` published to public search.
6. Verified public search (`/search?q=Machining`) displays newly verified supplier capability.

---

## 7. Remaining Risk Classification

- **BLOCKER**: None.
- **HIGH**: None.
- **MEDIUM**: None.
- **LOW**: Development dependency deprecation warnings in `npm audit` (standard Next.js / Tailwind dev tool transitive packages).
