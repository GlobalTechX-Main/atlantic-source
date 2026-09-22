# AGENTS.md — Permanent Engineering Instructions for AI Coding Agents

## 1. Core Mandate
You are working on **AtlanticSource**, a B2B supplier-intelligence and sourcing platform for Atlantic Canada. All future AI coding agents (Codex, Antigravity, Claude, etc.) operating in this repository MUST strictly comply with the engineering rules, architectural boundaries, and security policies in this document.

---

## 2. Fundamental Engineering Rules

### Rule 1: Understand AtlanticSource Scope Before Making Changes
- AtlanticSource is a B2B platform focused on market validation in Atlantic Canada (initially New Brunswick: Fredericton, Saint John, Moncton) across 12 specific industrial service categories.
- Do NOT alter core domain concepts or add speculative features (e.g. social networking, public reviews, payment processing, global multi-currency) unless explicitly requested in a task prompt.

### Rule 2: Strict TypeScript Enforcement
- Maintain strict TypeScript settings (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`).
- NEVER use `any`. Use precise types, generics, or `unknown` with Zod validation.
- All function signatures, API route parameters, and Server Action payloads MUST be explicitly typed.

### Rule 3: Enforce Authorization Server-Side
- EVERY Server Action, API Route, and page data fetch MUST validate authentication and role-based permissions server-side.
- NEVER trust client-supplied roles (`role`, `isAdmin`), user IDs (`userId`), or organization IDs (`orgId`) from query parameters, request bodies, or client state.
- Always retrieve user session and organization membership directly from trusted server session context (`requireAuth()`, `requireOrgMember()`).

### Rule 4: Evidence-Backed Data Publishing & Provenance Rule
- NEVER publish extracted supplier capability claims without explicit source provenance (`CrawlPage` reference, raw HTML text snippet, character offset, and CSS/XPath selector).
- NEVER silently classify crawler output as "verified" or "published". All extracted claims start in `DRAFT` / `UNREVIEWED` state and require explicit human admin review or verified claim approval.
- Preserving provenance data is non-negotiable.

### Rule 5: Crawler Network Safety & SSRF Guard Compliance
- ALL crawler network requests MUST pass through the SSRF protection module (`src/lib/crawler/fetcher.ts`).
- NEVER use standard `fetch()` directly on user-supplied or crawler-discovered URLs without pre-resolving DNS and checking IP blacklist rules (loopback, private IPv4/IPv6, link-local, cloud metadata IPs).
- Always enforce redirect validation, max payload size (5MB), and request timeouts.

### Rule 6: Absolute Prohibitions on AI in Current MVP
- The MVP version of AtlanticSource contains **NO AI**.
- Do NOT introduce OpenAI, Anthropic, Ollama, LangChain, vector databases, embeddings, or LLM APIs into any part of the MVP repository.
- Keep architectural boundaries clean (`ExtractionProvider` interface, `SearchFilterParser` interface) so future AI modules can be plugged in seamlessly without altering entity schemas.

### Rule 7: Zero Tolerance for Secrets Leakage & Environment Bypasses
- NEVER hardcode secrets, API keys, passwords, or connection strings in source code or committed documentation.
- All environment variables MUST be declared in `.env.example` and validated using Zod in `src/lib/env.ts`.

### Rule 8: Migration & Database Rules
- Database schema changes MUST be executed via explicit, reviewable Prisma migrations (`npx prisma migrate dev`).
- NEVER modify existing database columns or drop tables destructively without providing a safe data migration plan.
- Raw SQL queries MUST use Prisma's `Prisma.sql` tagged template literals to ensure 100% parameterization against SQL injection.

### Rule 9: Quality & Testing Integrity
- NEVER disable, skip (`.skip`), or comment out failing tests simply to make CI pass.
- If a test fails, diagnose and fix the root cause in the underlying code contract.
- CI pipeline MUST pass cleanly on every commit (`typecheck`, `lint`, `test`, `build`, `test:e2e`).

---

## 3. Checklist Before Committing Changes
Before finalizing any task or outputting completed code:
1. Run `npm run typecheck` — 0 errors.
2. Run `npm run lint` — 0 warnings/errors.
3. Run `npm run test` — All unit & integration tests pass.
4. Verify server-side authorization guards are present on new routes.
5. Confirm no hardcoded secrets or prohibited AI packages were added.
