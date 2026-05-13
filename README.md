# Elemental Pro

Aplicación web para registrar servicios técnicos de CCTV: órdenes de trabajo, carga de fotos antes/después, firma digital y generación de PDFs.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript + shadcn/ui (Tailwind CSS) |
| Backend | NestJS + TypeScript + Prisma ORM |
| Base de datos | PostgreSQL |
| Cola | Redis + BullMQ |
| Storage | MinIO (compatible S3) |
| Auth | JWT local (email + password) |
| Deploy | Railway (auto-deploy desde GitHub) |

## Funcionalidades

- **Autenticación** con roles `ADMIN` y `TECHNICIAN`; contraseña con validación de complejidad
- **Órdenes de trabajo** con numeración automática sin colisiones (advisory lock PostgreSQL)
- **Fotos ANTES / DESPUÉS** con compresión doble: cliente (browser-image-compression) y servidor (sharp)
- **Firma digital** del receptor con lienzo táctil
- **Generación de PDF** asíncrona con Puppeteer vía BullMQ — reintentos automáticos con backoff exponencial
- **Compresión de imágenes en PDF** — 70-90% menos peso (1200px máx, JPEG 72)
- **Dashboard de estadísticas** — total de servicios, este mes, con/sin firma, top técnicos
- **Exportar a CSV** con filtros activos (BOM UTF-8, compatible Excel)
- **Clonar servicio** — duplica todos los campos y genera nueva OT al instante
- **Filtros avanzados** — ubicación, técnico, tipo de mantenimiento, fecha, búsqueda global
- **Badge de firma** en la lista de servicios (firmado / sin firma)
- **Cámara directa en móvil** — botón que abre la cámara trasera sin pasar por galería
- **Gestión de empresas** con sucursales (locations)
- **Gestión de usuarios** (solo ADMIN) con soft delete y validación de servicios activos
- **Soft delete** en servicios y usuarios con auditoría completa (createdBy, updatedBy, deletedBy)
- **Health check** con ping real a la base de datos (responde 503 si falla)
- **Rate limiting** — 10 intentos/15min en login, 5/hora en registro, 100/15min global
- **Seguridad** — Helmet, CORS, JWT con validación de secreto al arrancar

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
# El registro público crea TECHNICIAN. Para crear ADMIN:
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-admin>" \
  -d '{"email":"admin@empresa.com","name":"Admin","password":"Password123!","role":"ADMIN"}'

# O registrar directamente (queda como TECHNICIAN, luego cambiar rol via PUT /api/users/:id)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","name":"Admin","password":"Password123!"}'
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

### Revertir a versión estable

```bash
# Volver al tag v1.0.0 (checkpoint antes de las mejoras de mayo 2026)
git checkout v1.0.0

# O desde Railway: re-deploy del commit 94675e0
```

## API

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Crear cuenta (siempre TECHNICIAN) |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Usuario autenticado |

### Servicios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/services` | Listar (paginado, filtros: ubicacion, search, nombreTecnico, tipoMantenimiento, fechaDesde, fechaHasta) |
| POST | `/api/services` | Crear servicio |
| GET | `/api/services/stats` | Estadísticas del dashboard |
| GET | `/api/services/export` | Exportar CSV (respeta filtros) |
| GET | `/api/services/:id` | Detalle |
| PUT | `/api/services/:id` | Actualizar |
| DELETE | `/api/services/:id` | Soft delete |
| POST | `/api/services/:id/clone` | Clonar servicio |

### Fotos
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/services/:id/photos/presign` | URL firmada para subir foto directo a S3 |
| POST | `/api/services/:id/photos/confirm` | Registrar foto ya subida |
| DELETE | `/api/services/:id/photos/:photoId` | Eliminar foto |

### PDFs
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/services/:id/pdfs` | Solicitar generación de PDF |
| GET | `/api/services/:id/pdfs/:pdfId` | Estado del PDF (PENDING → PROCESSING → READY \| ERROR) |

### Usuarios (solo ADMIN)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/users` | Listar usuarios |
| POST | `/api/users` | Crear usuario con rol |
| PUT | `/api/users/:id` | Actualizar usuario |
| DELETE | `/api/users/:id` | Soft delete (falla si tiene servicios activos) |

### Empresas (solo ADMIN)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/companies` | Listar empresas con sucursales |
| POST | `/api/companies` | Crear empresa |

### Sistema
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check con ping a base de datos |

## Estructura

```
.
├── backend/
│   ├── src/
│   │   ├── auth/               # JWT local + Cognito (deshabilitado)
│   │   ├── users/              # CRUD de usuarios (ADMIN only, soft delete)
│   │   ├── companies/          # Empresas y sucursales
│   │   ├── services/           # Órdenes de trabajo (entidad principal)
│   │   │   └── dto/            # create-service, filter-services, photo
│   │   ├── photos/             # Eliminar fotos vía endpoint /photos
│   │   ├── pdfs/               # Módulo PDF
│   │   │   └── pdf-worker/
│   │   │       ├── templates/
│   │   │       │   ├── report.html.ts   # plantilla HTML del PDF
│   │   │       │   └── logo.png         # logo (copiado a dist por NestJS)
│   │   │       ├── pdf-worker.processor.ts  # worker BullMQ
│   │   │       └── pdf-worker.module.ts
│   │   ├── queue/              # QueueService con @InjectQueue
│   │   ├── storage/            # Auto-creación de buckets al arrancar
│   │   ├── common/             # Filtros, interceptors
│   │   └── prisma/
│   ├── prisma/schema.prisma
│   ├── nest-cli.json           # assets: copia *.png a dist/
│   ├── Dockerfile
│   └── railway.toml
├── frontend/
│   ├── public/
│   │   └── favicon.png         # favicon (logo Elemental)
│   ├── src/
│   │   ├── api/                # Clientes axios (services, photos, pdfs, users, companies)
│   │   ├── components/         # ServiceFilters, PhotoUploader, PdfStatus, Layout, UI
│   │   ├── hooks/              # useServices, usePhotos, useAuth
│   │   ├── pages/              # Dashboard, ServiceDetail, Create, Edit, Users, Companies
│   │   ├── store/              # Zustand (authStore)
│   │   └── types/              # Tipos TypeScript compartidos
│   └── Dockerfile
├── docker-compose.local.yml
├── RAILWAY.md                  # Guía de deploy en Railway
└── CLAUDE.md                   # Contexto para Claude Code
```

## Modelo de datos

| Modelo | Descripción |
|--------|-------------|
| `User` | Usuarios con rol, contraseña hasheada (bcrypt), soft delete |
| `Company` + `Location` | Jerarquía empresa → sucursal |
| `Service` | Orden de trabajo — entidad principal con soft delete y audit trail |
| `ServicePhoto` | Fotos BEFORE/AFTER en MinIO, con orden |
| `ServicePdf` | PDFs generados async — estados: PENDING → PROCESSING → READY \| ERROR; incluye dataSnapshot |

## Notas técnicas

- **Numeración OT**: `pg_advisory_xact_lock` garantiza unicidad incluso bajo carga concurrente. El campo tiene `@unique` como red de seguridad.
- **PDF asíncrono**: el worker descarga fotos de S3, las comprime con sharp (1200px, JPEG 72) y genera el PDF con Puppeteer. Reintenta hasta 3 veces con backoff exponencial.
- **Zona horaria**: el servidor corre en UTC. El PDF usa `Intl.DateTimeFormat` con `timeZone: 'America/Santiago'` para hora chilena correcta (maneja DST).
- **Soft delete**: servicios y usuarios usan `deletedAt`. Los usuarios no se pueden eliminar si tienen servicios activos.
- **QueueService**: usa `@InjectQueue` de `@nestjs/bullmq` — una sola conexión Redis gestionada por el módulo.
- **Buckets**: `StorageInitService` los crea automáticamente al arrancar con política de lectura pública.
