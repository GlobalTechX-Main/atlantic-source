# AtlanticSource

**AtlanticSource** is a B2B supplier-intelligence and sourcing platform tailored for Atlantic Canada. It enables regional buyers to discover verified suppliers, perform structured keyword and category searches, review evidence-backed capability profiles, and issue sourcing requests (RFQs) with one-click supplier response flows.

---

## Technical Stack
- **Framework**: Next.js App Router (React 19 / Server Components)
- **Language**: TypeScript (Strict Mode)
- **Database**: PostgreSQL 16 (with `pg_trgm` & Full-Text Search)
- **ORM**: Prisma ORM
- **Authentication**: Auth.js (NextAuth)
- **Styling**: Tailwind CSS
- **Testing**: Vitest (Unit/Integration) & Playwright (E2E)
- **Containerization**: Docker & Docker Compose

---

## Getting Started

### Prerequisites
- Node.js `^20.0.0` or `^22.0.0` or `^24.0.0`
- npm `^10.0.0`
- Docker Desktop or Docker Engine

### 1. Repository Setup
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
Ensure database connection credentials match your local setup.

### 3. Start Local Database (PostgreSQL)
Spin up local PostgreSQL container with `pg_trgm` enabled:
```bash
docker compose up -d
```

### 4. Database Setup & Migration
Push Prisma schema to local database:
```bash
npx prisma db push
```

(Optional) Seed initial development data:
```bash
npm run db:seed
```

### 5. Start Development Application & Background Worker

Local development requires running **two background processes** alongside the Docker infrastructure:

**Terminal 1: Next.js Web Server**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

**Terminal 2: Crawler Background Worker**
```bash
npm run worker
```
The crawler worker continuously polls PostgreSQL for `QUEUED` (`PENDING`) crawl jobs, executes safe SSRF-guarded web crawling, runs deterministic extraction, and persists `SourceDocuments` and `ExtractedClaims`.

---

## Local Admin Authentication & Console Access

### Platform Admin Identity
In local development, server-side session resolution (`getCurrentUserSession()`) automatically looks up the seeded platform admin user from the database:
- **Email**: `admin@atlanticsource.ca`
- **Role in Database**: `isPlatformAdmin = true`
- **Admin Console URL**: [http://localhost:3000/admin](http://localhost:3000/admin) (or `/admin/suppliers`)

### Database Seeding
Ensure the database has been seeded with the baseline admin account:
```bash
npm run db:seed
```

### Server-Side Role Enforcement
All admin actions (such as manual supplier creation in `/admin/suppliers`) enforce server-side RBAC validation against the database `User` record (`session.isPlatformAdmin`). Spoofing client headers or state does not bypass authorization.

---

## Health Check
Verify system status and database connectivity:
```bash
curl http://localhost:3000/api/health
```

---

## Verification & Testing Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run typecheck` | Run TypeScript strict type checking |
| `npm run lint` | Run ESLint static analysis |
| `npm run test` | Run Vitest unit & integration tests |
| `npm run test:e2e` | Run Playwright browser end-to-end tests |
| `npm run build` | Build Next.js application for production |
| `npm run db:push` | Push schema changes directly to development DB |
| `npm run db:studio` | Open Prisma Studio UI to inspect database |

---

## Architecture & Security Documentation
- [System Architecture Specification](docs/ARCHITECTURE.md)
- [Security Model & Threat Matrix](docs/SECURITY_MODEL.md)
- [Engineering Implementation Roadmap](docs/IMPLEMENTATION_PLAN.md)
- [AI Agent Instructions](AGENTS.md)
