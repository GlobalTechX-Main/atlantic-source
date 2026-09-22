# AtlanticSource — Master Engineering Implementation Roadmap

## 1. Overview
This document outlines the phased engineering roadmap for **AtlanticSource**, moving from the Prompt 1 Foundation phase through full MVP production readiness.

---

## 2. Implementation Phases

### Phase 1: Repository & System Foundation (Current - Prompt 1)
- [x] Repository architecture & engineering documentation (`ARCHITECTURE.md`, `SECURITY_MODEL.md`, `AGENTS.md`, `README.md`).
- [x] Next.js App Router initialization with TypeScript strict mode.
- [x] Prisma ORM configuration & database schema definition.
- [x] Environment validation with Zod (`src/lib/env.ts`).
- [x] Centralized logging (`Pino`) and structured application error classes.
- [x] Security headers and middleware configuration.
- [x] Health check endpoint (`/api/health`) verifying database connectivity.
- [x] Docker setup (`docker-compose.yml` for local PostgreSQL & multi-stage `Dockerfile`).
- [x] Testing pipeline setup (Vitest unit/integration tests & Playwright E2E tests).
- [x] GitHub Actions CI workflow (`ci.yml`).

---

### Phase 2: Safe Web Crawler & Deterministic Extraction Engine
- [ ] Safe Crawler Orchestrator (`src/lib/crawler/fetcher.ts`):
  - SSRF protection layer with DNS resolution & IP blacklisting.
  - Rate limiting (minimum 2s delay per domain).
  - Robots.txt parser and HTTP size caps (5MB).
  - Raw HTML saving to object store / database (`CrawlPage`).
- [ ] Deterministic Extraction Rules Engine (`src/lib/extraction/engine.ts`):
  - CSS / Regex category matcher mapping site text to 12 target categories.
  - Source evidence offset calculator (`extractedText`, `cssSelector`, `characterOffset`).
  - Provenance hash generation (`rawHtmlHash`).
- [ ] Automated extraction unit tests against realistic HTML samples.

---

### Phase 3: Admin Review Console & Profile Verification Workflow
- [ ] Admin Review Console UI (`src/app/(admin)/review`):
  - Split-screen comparison view (Extracted Claims vs Raw Page Text).
  - Confirm, edit, reject, and add claim capabilities.
  - Publication state machine (`DRAFT` $\rightarrow$ `PUBLISHED` / `NEEDS_REVISION`).
- [ ] Supplier Verification & Claiming Workflow:
  - Claim request submission UI.
  - Automated domain match verification logic.
  - Document upload & admin claim approval queue.
- [ ] Admin audit logging system.

---

### Phase 4: Buyer Search, Directory & Matching Engine
- [ ] Public Supplier Directory (`src/app/suppliers`):
  - Category filters (12 core categories).
  - Geographic filters (Fredericton, Saint John, Moncton, All NB).
  - Verification badge indicators.
- [ ] Search Engine Implementation (`src/lib/search/engine.ts`):
  - PostgreSQL full-text search (`tsvector`) integration.
  - Trigram fuzzy matching (`pg_trgm`) for typo tolerance.
  - Deterministic relevance scoring algorithm.
- [ ] Supplier Detail Profile View (`src/app/suppliers/[slug]`):
  - Capabilities list with provenance indicators.
  - Location addresses & contact information.
  - Claimed status badge.

---

### Phase 5: Buyer Sourcing Requests (RFQ) & Tokenized Supplier Outreach
- [ ] Buyer Sourcing Request Builder (`src/app/(buyer)/rfq/new`):
  - Multi-step RFQ form (Title, Description, Required Categories, Location, Deadline).
  - File attachment uploader (PDF/DOCX/DWG with MIME & size validation).
  - Supplier selection / automated matching suggestions.
- [ ] Tokenized Email Outreach & Single-Use Access Tokens:
  - Secure token generation (`crypto.randomBytes(32)`).
  - Transactional email dispatch system.
- [ ] One-Click Supplier Response View (`src/app/rfq/respond`):
  - Status options: `INTERESTED` (with optional quote amount & lead time), `NEED_INFO`, `DECLINE`.
  - Secure submission without requiring password login.
- [ ] Buyer Sourcing Dashboard (`src/app/(buyer)/dashboard`):
  - Track response rates, view indicative quotes, download submitted files.

---

### Phase 6: System Hardening, Operations & Production Readiness
- [ ] Database migrations & production database indexing audit.
- [ ] End-to-end user testing flows (Crawler $\rightarrow$ Extraction $\rightarrow$ Admin Publish $\rightarrow$ Search $\rightarrow$ RFQ $\rightarrow$ Supplier Response).
- [ ] Security audit & penetration testing verification against `SECURITY_MODEL.md`.
- [ ] Production deployment verification.
