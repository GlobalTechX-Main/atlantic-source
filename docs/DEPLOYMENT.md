# AtlanticSource — Deployment & Operational Specification

## 1. Production Architecture Overview
The AtlanticSource production environment consists of five core infrastructure components:

```
[ User Browser / HTTPS ]
          │
          ▼
┌─────────────────────────┐
│     Next.js Web App     │
│   (App Router Node.js)  │
└────────────┬────────────┘
             │
   ┌─────────┴─────────┬───────────────────┐
   ▼                   ▼                   ▼
┌──────────────┐ ┌─────────────┐ ┌───────────────────┐
│ PostgreSQL   │ │ Managed S3  │ │ Transactional     │
│ (SSL Encrypted)│ │ (Private)   │ │ Email Provider    │
└──────────────┘ └─────────────┘ └───────────────────┘
```

---

## 2. Required Environment Variables

Declarations in `.env.example` verified via Zod schema (`src/lib/env.ts`):

```bash
# Database
DATABASE_URL="postgresql://user:password@pg-host:5432/atlanticsource?sslmode=require"

# Application Security & Authentication
AUTH_SECRET="32-character-crypto-random-secret-key-here"
NEXTAUTH_URL="https://atlanticsource.ca"

# S3 Private Object Storage
S3_ENDPOINT="https://s3.ca-central-1.amazonaws.com"
S3_BUCKET="atlanticsource-private-attachments"
S3_REGION="ca-central-1"
S3_ACCESS_KEY_ID="AKIA..."
S3_SECRET_ACCESS_KEY="..."

# Transactional Email Provider
EMAIL_PROVIDER="production_provider"
EMAIL_FROM_ADDRESS="outreach@atlanticsource.ca"
EMAIL_WEBHOOK_SECRET="webhook-secret-key-32bytes"

# Network & Crawler Bounds
MAX_CRAWL_DEPTH="2"
MAX_PAGES_PER_RUN="25"
CRAWLER_USER_AGENT="AtlanticSourceBot/1.0 (+https://atlanticsource.ca/bot)"
```

---

## 3. Environment Setups & Deployments

### 3.1 Local Development
1. Start local PostgreSQL infrastructure: `docker compose up -d`
2. Apply database migrations: `npx prisma db push`
3. Seed baseline dataset & admin account: `npm run db:seed`
4. Launch development application (Terminal 1): `npm run dev`
5. Launch background crawler worker (Terminal 2): `npm run worker`

### 3.2 Staging & Production Deployment Process
1. **Pre-Deployment Check**:
   - Run typecheck: `npm run typecheck`
   - Run linter: `npm run lint`
   - Run test suite: `npm run test`
   - Run build: `npm run build`
2. **Database Migration Execution**:
   - Execute safe pending migrations: `npx prisma migrate deploy`
3. **Application Container Deployment**:
   - Deploy container image to App Runner / ECS / Managed Host.
4. **Health Check Verification**:
   - Query `/api/health` — ensure HTTP 200 and `"status": "ok"`.

---

## 4. Operational Maintenance & Rollback Procedures

### 4.1 Database Backup Strategy
- Daily automated snapshot backups with 30-day point-in-time recovery (PITR).
- Pre-migration logical export prior to major migrations.

### 4.2 Rollback Procedure
1. Revert container image to previous release tag.
2. If migration occurred, execute safe down-migration plan documented in Prisma migration directory.

### 4.3 Rate Limits & Abuse Limits
- Maximum 10 RFQs created per hour per buyer organization.
- Maximum 20 recipient suppliers per RFQ.
- Crawler rate limiting: Minimum 2.0s delay between requests to same domain.
