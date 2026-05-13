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

### Autenticación y seguridad
- Roles `ADMIN` y `TECHNICIAN`; contraseña con validación de complejidad
- JWT con verificación en BD por cada request — detecta usuarios eliminados o con rol cambiado sin necesidad de re-login
- Usuarios con soft delete bloqueados en login y en cada request autenticado
- Rate limiting: 10 intentos/15min en login, 5/hora en registro, 100/15min global

### Órdenes de trabajo
- Numeración automática `YYYY-NNN` sin colisiones usando `pg_advisory_xact_lock`
- Filtros avanzados: ubicación, técnico, tipo de mantenimiento, rango de fechas, búsqueda global
- **Clonar servicio** — duplica todos los campos con la fecha actual y genera nueva OT al instante
- **Exportar a CSV** con filtros activos (BOM UTF-8, compatible Excel, fechas en formato DD/MM/YYYY)
- Soft delete con auditoría completa (`createdBy`, `updatedBy`, `deletedBy`, `deletedAt`)

### Fotos
- Categorías **ANTES / DESPUÉS** con orden persistente
- Compresión en cliente antes de subir: máx. 1 MB y 1920 px (`browser-image-compression`)
- Subida directa a MinIO vía URL presignada (sin pasar por el backend)
- **Lightbox** — clic en cualquier foto la amplía a pantalla completa; Esc o clic fuera para cerrar
- **Botón de cámara** en móvil que abre directamente la cámara trasera
- Límite de 30 fotos por servicio

### PDFs
- Generación asíncrona con Puppeteer vía BullMQ
- Reintentos automáticos: hasta 3 intentos con backoff exponencial (5 s → 10 s → 20 s)
- Compresión de imágenes embebidas con sharp: 1200 px máx, JPEG calidad 72
- Snapshot inmutable de los datos del servicio al momento de generación
- Polling automático en el frontend (5 s, máx. 5 minutos) con opción de reintentar si se agota
- **Notificación del navegador** cuando el PDF está listo (requiere permiso del usuario)
- **Historial de versiones** — cada regeneración incrementa la versión y conserva el historial
- **Descarga masiva de PDFs como ZIP** — seleccionar múltiples servicios en el dashboard y descargar todos sus últimos PDFs en un archivo `informes-YYYY-MM-DD.zip`

### Dashboard
- Estadísticas: total de servicios, servicios del mes actual, con firma y sin firma
- Checkboxes de selección múltiple con barra de acciones (descarga masiva)
- Paginación (20 registros por página)
- Indicador de estado del PDF y firma en la lista

### Gestión de empresas y ubicaciones
- Jerarquía empresa → sucursal (locations)
- Protección de borrado: una empresa no se puede eliminar si tiene servicios activos asociados

### Gestión de usuarios (solo ADMIN)
- CRUD completo con paginación
- Soft delete (usuarios eliminados no pueden iniciar sesión)
- No se puede eliminar un usuario con servicios activos

### Sistema
- Health check con ping real a PostgreSQL (responde 503 si falla)
- Helmet, CORS (origen único configurable por variable de entorno)
- Logs estructurados con interceptor global y filtro de excepciones HTTP
- Shutdown hooks: Prisma y BullMQ cierran conexiones limpiamente en SIGTERM

---

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

---

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

---

## API

### Auth

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Crear cuenta (siempre TECHNICIAN) |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Usuario autenticado actual |

### Servicios

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/services` | Listar (paginado; filtros: `ubicacion`, `search`, `nombreTecnico`, `tipoMantenimiento`, `fechaDesde`, `fechaHasta`, `page`, `limit`) |
| POST | `/api/services` | Crear servicio |
| GET | `/api/services/stats` | Estadísticas del dashboard |
| GET | `/api/services/export` | Exportar CSV (respeta filtros activos) |
| POST | `/api/services/bulk-pdf-download` | Descargar PDFs de múltiples servicios como ZIP (`{ serviceIds: string[] }`) |
| GET | `/api/services/:id` | Detalle del servicio |
| PUT | `/api/services/:id` | Actualizar servicio |
| DELETE | `/api/services/:id` | Soft delete |
| POST | `/api/services/:id/clone` | Clonar servicio (nueva OT, fecha actual) |

### Fotos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/services/:id/photos/presign` | URL firmada para subir foto directo a S3 |
| POST | `/api/services/:id/photos/confirm` | Registrar foto ya subida en la BD |
| DELETE | `/api/services/:id/photos/:photoId` | Eliminar foto (S3 + BD) |

### PDFs

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/services/:id/pdfs` | Solicitar generación de PDF (encola job BullMQ) |
| GET | `/api/services/:id/pdfs/:pdfId` | Estado del PDF (`PENDING` → `PROCESSING` → `READY` \| `ERROR`) |

### Usuarios (solo ADMIN)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/users` | Listar usuarios paginado (`?page=1&limit=20`) |
| POST | `/api/users` | Crear usuario con rol |
| PUT | `/api/users/:id` | Actualizar nombre, teléfono, rol o contraseña |
| DELETE | `/api/users/:id` | Soft delete (falla si tiene servicios activos) |

### Empresas (solo ADMIN para escritura)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/companies` | Listar empresas con sus sucursales |
| POST | `/api/companies` | Crear empresa |
| PUT | `/api/companies/:id` | Renombrar empresa |
| DELETE | `/api/companies/:id` | Eliminar empresa (falla si tiene servicios activos) |
| GET | `/api/companies/:id/locations` | Sucursales de una empresa |
| POST | `/api/companies/:id/locations` | Agregar sucursal |
| DELETE | `/api/companies/:id/locations/:locationId` | Eliminar sucursal |

### Sistema

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check con ping real a PostgreSQL |

---

## Estructura

```
.
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   │   ├── jwt.strategy.ts          # Valida JWT; consulta BD para rol fresco y usuario activo
│   │   │   ├── auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── local/                   # Login/register con JWT local
│   │   ├── users/                       # CRUD usuarios (ADMIN only, soft delete)
│   │   ├── companies/                   # Empresas y sucursales
│   │   ├── services/                    # Órdenes de trabajo (entidad principal)
│   │   │   └── dto/                     # create-service, update-service, filter-services, photo
│   │   ├── pdfs/                        # Módulo PDF
│   │   │   └── pdf-worker/
│   │   │       ├── templates/
│   │   │       │   ├── report.html.ts   # Plantilla HTML del informe
│   │   │       │   └── logo.png         # Logo (copiado a dist/ por NestJS assets)
│   │   │       ├── pdf-worker.processor.ts   # Worker BullMQ (sharp + Puppeteer)
│   │   │       └── pdf-worker.module.ts
│   │   ├── queue/                       # QueueService con @InjectQueue
│   │   ├── storage/                     # Auto-creación de buckets al arrancar
│   │   ├── common/                      # HttpExceptionFilter, LoggingInterceptor
│   │   └── prisma/
│   ├── prisma/schema.prisma
│   ├── nest-cli.json                    # assets: copia *.png a dist/
│   ├── Dockerfile
│   └── railway.toml
├── frontend/
│   ├── public/
│   │   └── favicon.png                  # Favicon (logo Elemental)
│   ├── src/
│   │   ├── api/                         # Clientes axios: services, photos, pdfs, users, companies
│   │   ├── components/                  # ServiceFilters, PhotoUploader (con lightbox), PdfStatus, Layout, UI
│   │   ├── hooks/                       # useServices, usePhotos, useAuth
│   │   ├── pages/                       # Dashboard, ServiceDetail, Create, Edit, Users, Companies, Login
│   │   ├── store/                       # Zustand (authStore)
│   │   └── types/                       # Tipos TypeScript compartidos
│   └── Dockerfile
├── docker-compose.local.yml
├── RAILWAY.md                           # Guía de deploy en Railway
└── CLAUDE.md                            # Contexto para Claude Code
```

---

## Modelo de datos

| Modelo | Descripción |
|--------|-------------|
| `User` | Usuarios con rol, contraseña hasheada (bcrypt), soft delete |
| `Company` + `Location` | Jerarquía empresa → sucursal |
| `Service` | Orden de trabajo — entidad principal con soft delete y audit trail completo |
| `ServicePhoto` | Fotos BEFORE/AFTER en MinIO con orden; comprimidas en cliente antes de subir |
| `ServicePdf` | PDFs generados async — estados `PENDING → PROCESSING → READY \| ERROR`; incluye `dataSnapshot` y `version` |

---

## Notas técnicas

- **Numeración OT**: `pg_advisory_xact_lock` garantiza unicidad incluso bajo carga concurrente. El campo `ordenTrabajo` tiene `@unique` como red de seguridad adicional.
- **JWT por request**: en modo `LOCAL_AUTH=true`, cada request autenticado consulta la BD para obtener el rol actualizado y verificar que el usuario no esté eliminado. Si el usuario fue desactivado, el token vigente queda inválido de inmediato.
- **PDF asíncrono**: el worker descarga fotos de S3, las comprime con sharp (1200 px, JPEG 72) y genera el PDF con Puppeteer. Reintenta hasta 3 veces con backoff exponencial (5 s inicial).
- **Descarga masiva ZIP**: el endpoint `bulk-pdf-download` obtiene los archivos PDF directamente desde MinIO en el servidor y los empaqueta con `archiver` antes de enviarlos al cliente, evitando problemas de CORS.
- **Zona horaria**: el servidor corre en UTC. El PDF usa `Intl.DateTimeFormat` con `timeZone: 'America/Santiago'` para hora chilena correcta (maneja DST automáticamente).
- **Soft delete**: servicios y usuarios usan `deletedAt`. Los usuarios y empresas no se pueden eliminar si tienen servicios activos.
- **Buckets MinIO**: `StorageInitService` los crea automáticamente al arrancar vía `OnModuleInit`. No es necesario crearlos manualmente.
- **Compresión de fotos**: `browser-image-compression` corre en un Web Worker (no bloquea la UI). La barra de progreso refleja el avance real de subida vía `onUploadProgress` de axios.
