# Elemental Pro

Aplicación web para registrar servicios técnicos de CCTV: órdenes de trabajo, carga de fotos antes/después, firma digital y generación de PDFs.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript + shadcn/ui (Tailwind CSS) |
| Backend | NestJS + TypeScript + Prisma ORM |
| Base de datos | PostgreSQL |
| Cola | Redis + BullMQ |
| Storage | MinIO (compatible S3) |
| Auth | JWT local (email + password) |
| Deploy | Railway (auto-deploy desde GitHub) |

## Desarrollo local

### Requisitos

- Node.js 20+
- Docker & Docker Compose

### 1. Variables de entorno

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edita `backend/.env` con los valores locales (la base de datos local ya viene configurada en docker-compose).

### 2. Levantar servicios de infraestructura

```bash
docker-compose -f docker-compose.local.yml up -d
```

Esto levanta PostgreSQL, Redis y MinIO.

### 3. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

API disponible en `http://localhost:3001/api`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend disponible en `http://localhost:5173`.

### 5. Crear usuario admin inicial

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","name":"Admin","password":"Password123!","role":"ADMIN"}'
```

## Deploy en Railway

El repositorio está conectado a Railway con **auto-deploy**: cada `git push origin main` dispara el rebuild automático de ambos servicios.

Ver [RAILWAY.md](RAILWAY.md) para el paso a paso completo de configuración inicial.

### URLs de producción

| Servicio | URL |
|---|---|
| Frontend | `https://informes.elementalpro.cl` |
| Backend API | `https://backend-production-c31d.up.railway.app/api` |
| Health check | `https://backend-production-c31d.up.railway.app/api/health` |

### Subir cambios

```bash
git push origin main
# Railway detecta el push y rebuilds backend y frontend automáticamente
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Crear usuario |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/services` | Listar servicios (paginado, filtrable) |
| POST | `/api/services` | Crear servicio |
| GET | `/api/services/:id` | Detalle de servicio |
| PUT | `/api/services/:id` | Actualizar servicio |
| DELETE | `/api/services/:id` | Eliminar (soft delete) |
| POST | `/api/services/:id/photos/presign` | Obtener URL firmada para subir foto |
| POST | `/api/services/:id/photos/confirm` | Confirmar foto subida |
| DELETE | `/api/services/:id/photos/:photoId` | Eliminar foto |
| POST | `/api/services/:id/pdfs` | Generar PDF |
| GET | `/api/services/:id/pdfs/:pdfId` | Estado del PDF |
| GET | `/api/companies` | Listar empresas |
| POST | `/api/companies` | Crear empresa |
| GET | `/api/health` | Health check |

## Estructura

```
.
├── backend/               # NestJS API
│   ├── src/
│   │   └── pdfs/pdf-worker/templates/
│   │       ├── report.html.ts   # plantilla HTML del PDF
│   │       └── logo.png         # logo Elemental (copiado a dist por NestJS)
│   ├── prisma/
│   ├── nest-cli.json      # assets: copia *.png a dist/
│   ├── Dockerfile
│   └── railway.toml
├── frontend/              # React + Vite
│   ├── public/
│   │   └── favicon.png    # favicon (logo Elemental)
│   ├── src/
│   └── Dockerfile
├── docker-compose.local.yml
├── RAILWAY.md             # Guía de deploy en Railway
└── CLAUDE.md              # Contexto para Claude Code
```

## Funcionalidades

- Autenticación con roles: `ADMIN` y `TECHNICIAN`
- Registro de órdenes de trabajo con datos del cliente y técnico
- Carga de fotos ANTES / DESPUÉS con compresión en cliente
- Firma digital del receptor
- Generación asíncrona de PDFs con Puppeteer (logo, zona horaria Chile, comentarios técnicos)
- Filtros por empresa, ubicación, fecha y texto
- Paginación en listado de servicios
- Gestión de empresas con sucursales (locations)
