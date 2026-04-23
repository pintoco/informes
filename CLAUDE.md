# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Elemental Pro** — Web app for logging CCTV technical services. Technicians create service records with metadata, BEFORE/AFTER photos, digital signatures, and auto-generated PDF reports.

## Development Commands

### Local Development (Docker)
```bash
# Start full local stack (PostgreSQL + MinIO + Redis + backend + frontend)
docker compose up -d

# View logs
docker logs elemental_backend_local -f
docker logs elemental_frontend_local -f

# Apply schema changes to local DB
docker exec elemental_backend_local sh -c "cd /app && npx prisma db push --accept-data-loss"
```

### Backend (NestJS)
```bash
cd backend
npm ci
npx prisma generate        # Regenerate Prisma client after schema changes
npm run build              # TypeScript compile
npm run start:dev          # Hot-reload dev server on port 3001
```

### Frontend (React + Vite)
```bash
cd frontend
npm ci
npm run dev                # Dev server on port 5173
npm run build              # Production build (fails on TS errors)
```

### Production Deployment
```bash
# Build ALL backend-related images when schema changes (migrate + backend)
docker compose --env-file .env.prod -f docker-compose.prod.yml build migrate backend frontend

# Restart services without re-running migrate (safe for frontend-only changes)
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --no-deps frontend

# Full production restart
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

## Architecture

### Deployment Modes
1. **Local dev** — `docker-compose.yml`: hot-reload, Vite proxy to NestJS, MinIO for S3
2. **Production** — `docker-compose.prod.yml`: built images, Nginx reverse proxy, Let's Encrypt SSL via Cloudflare DNS, MinIO, Redis, BullMQ
3. **AWS serverless** — `infrastructure/` CDK: Lambda + API Gateway + RDS + S3 + SQS + CloudFront (not currently active)

### Backend (`backend/src/`)
NestJS modules, each self-contained with controller/service/module:
- **auth/** — JWT auth guard + local auth (email/bcrypt). `LOCAL_AUTH=true` env bypasses Cognito.
- **services/** — Main CRUD. Includes presigned S3 URL generation for direct browser→MinIO uploads (two-step: presign → upload → confirm).
- **pdfs/** — PDF generation via BullMQ queue. `pdf-worker/pdf-worker.processor.ts` processes jobs: fetches photos from S3 as base64, renders HTML template, Puppeteer→PDF, uploads to MinIO.
- **photos/** — Photo management (BEFORE/AFTER categories, max 20 per service).
- **companies/** — Company + Location management (used to populate dropdowns in service form).
- **users/** — Admin CRUD for user management.
- **queue/** — BullMQ + Redis setup.

### Frontend (`frontend/src/`)
- **api/** — Thin axios wrappers per resource. `client.ts` is the axios instance with JWT header injection.
- **store/authStore.ts** — Zustand store (persisted to localStorage). Holds `user`, `token`, `isAuthenticated`.
- **hooks/** — `useServices`, `usePhotos` encapsulate API calls + loading/error/toast state.
- **components/ServiceForm.tsx** — Main form for creating/editing services. When companies exist in DB, shows Select dropdowns for empresa/ubicación; falls back to text Input. Auto-fills technician fields from `authStore` user.
- **pages/CreateServicePage.tsx** — Two-step flow: (1) ServiceForm → creates service, (2) shows PhotoUploader + SignatureCanvas + PdfStatus.

### Data Flow: Photo Upload
1. Frontend requests presigned PUT URL → `POST /api/services/:id/photos/presign`
2. Browser uploads directly to MinIO using presigned URL
3. Frontend confirms → `POST /api/services/:id/photos/confirm` (saves record to DB)

### Data Flow: PDF Generation
1. `POST /api/services/:id/pdfs` → creates `ServicePdf` record (PENDING) + enqueues BullMQ job
2. Worker fetches service + photos from DB, downloads photos from S3 as base64
3. Renders `report.html.ts` template → Puppeteer generates PDF → uploads to MinIO
4. Updates `ServicePdf` status to READY with public URL
5. Frontend polls `GET /api/services/:id/pdfs/:pdfId` every 5s

## Critical Implementation Details

### Schema Changes
When adding fields to `schema.prisma`, you must rebuild **both** `migrate` and `backend` images — otherwise the migrate container runs with the old schema and can **drop** newly added columns:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml build migrate backend
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d backend
```

### Nginx + MinIO Proxy
`nginx-ssl/app.conf` proxies `/elemental-photos/` and `/elemental-pdfs/` to MinIO. **Do not use `set $variable` approach** for these locations — nginx with a variable in `proxy_pass` does not rewrite the URI, causing MinIO to receive wrong paths. Use direct `proxy_pass http://minio:9000/bucket-name/;`.

### AWS SDK v3 + MinIO
The `s3ClientPublic` in `services.service.ts` uses `requestChecksumCalculation: 'WHEN_REQUIRED'` to disable automatic CRC32 checksums that MinIO rejects.

### S3 Public URLs
`S3_PUBLIC_ENDPOINT` must include the port if running on non-standard ports (e.g., `https://elementalpro.net:7443`). This value is used to build browser-accessible URLs for photos and PDFs.

### Frontend TypeScript
`frontend/tsconfig.json` has `noUnusedLocals: false` and `noUnusedParameters: false` — intentional, required for production builds to succeed.

### Auth Passwords
To reset a user password in production:
```bash
docker exec elemental_backend_prod node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('newpassword', 10).then(h => console.log(h));
"
# Then update DB directly via psql
```

## Environment Variables

Key backend vars:
- `LOCAL_AUTH=true` — enables email/password auth instead of Cognito
- `S3_ENDPOINT` — internal MinIO URL (e.g., `http://minio:9000`)
- `S3_PUBLIC_ENDPOINT` — browser-accessible URL for file links
- `S3_FORCE_PATH_STYLE=true` — required for MinIO
- `REDIS_URL` — BullMQ connection

Key frontend build args (baked at build time):
- `VITE_API_URL` — set to `/api` in production (proxied by Nginx)
- `VITE_AUTH_MODE` — `local` or `cognito`
