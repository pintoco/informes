# Elemental Pro

A production-ready web application for logging technical services with photo uploads and PDF generation.

## Architecture

- **Frontend**: React + Vite + TypeScript + shadcn/ui (Tailwind CSS)
- **Backend**: NestJS + TypeScript + Prisma ORM
- **Database**: PostgreSQL (AWS RDS)
- **Auth**: Amazon Cognito with Google IdP
- **Storage**: AWS S3 (photos + PDFs)
- **Queue**: AWS SQS (PDF generation jobs)
- **Infrastructure**: AWS CDK (Lambda + API Gateway + RDS + S3 + SQS + CloudFront)
- **CI/CD**: GitHub Actions

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- AWS CLI configured
- AWS CDK v2

## Local Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd elemental-pro
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env with your values
npm install
```

### 3. Start local database

```bash
cd backend
docker-compose up db -d
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run backend

```bash
cd backend
npm run start:dev
```

### 5. Frontend setup

```bash
cd frontend
cp .env.example .env
# Edit .env with your values
npm install
npm run dev
```

The frontend will be available at http://localhost:5173 and backend at http://localhost:3001/api.

## Running with Docker Compose

```bash
cd backend
docker-compose up --build
```

## Deployment

### 1. Configure GitHub Secrets

Set the following secrets in your GitHub repository:

| Secret | Description |
|--------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | IAM Role ARN for GitHub OIDC |
| `VITE_API_URL` | API Gateway URL |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `VITE_COGNITO_DOMAIN` | Cognito domain |
| `VITE_COGNITO_REDIRECT_URI` | CloudFront URL |
| `FRONTEND_BUCKET` | S3 bucket name for frontend |
| `CF_DISTRIBUTION_ID` | CloudFront distribution ID |

### 2. Deploy infrastructure

```bash
cd infrastructure
npm install
npm run deploy
```

### 3. Manual deploy script

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## AWS Costs (estimated)

| Service | Monthly Cost |
|---------|-------------|
| RDS t3.micro (PostgreSQL) | ~$15 |
| Lambda (2M requests) | ~$0.40 |
| API Gateway | ~$3.50 |
| S3 (10GB) | ~$0.23 |
| CloudFront | ~$1 |
| SQS | ~$0.40 |
| Cognito (10K MAU) | Free tier |
| **Total** | **~$20/month** |

## Features Checklist

- [x] User authentication via Amazon Cognito + Google SSO
- [x] Role-based access control (ADMIN / TECHNICIAN)
- [x] Service CRUD with soft delete
- [x] Advanced filtering (location, date range, search)
- [x] Photo upload (BEFORE / AFTER, max 20 photos)
- [x] Client-side image compression
- [x] Digital signature capture
- [x] Async PDF generation via SQS
- [x] PDF status polling
- [x] Paginated service list
- [x] S3 presigned URLs for direct uploads
- [x] Serverless backend (Lambda + API Gateway)
- [x] Infrastructure as Code (AWS CDK)
- [x] CI/CD pipeline (GitHub Actions)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/services | List services (paginated, filterable) |
| POST | /api/services | Create service |
| GET | /api/services/:id | Get service details |
| PUT | /api/services/:id | Update service |
| DELETE | /api/services/:id | Soft delete service |
| POST | /api/services/:id/photos/presign | Get presigned URL |
| POST | /api/services/:id/photos/confirm | Confirm photo upload |
| DELETE | /api/services/:id/photos/:photoId | Delete photo |
| POST | /api/services/:id/pdfs | Request PDF generation |
| GET | /api/services/:id/pdfs/:pdfId | Get PDF status |

## Project Structure

```
elemental-pro/
├── frontend/          # React + Vite frontend
├── backend/           # NestJS backend
├── infrastructure/    # AWS CDK infrastructure
├── scripts/           # Deployment scripts
└── .github/workflows/ # CI/CD pipelines
```
