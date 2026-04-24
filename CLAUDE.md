# Elemental Pro — CLAUDE.md

Aplicación para registrar servicios técnicos de CCTV con carga de fotos y generación de PDFs.

## Stack actual (producción en Railway)

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript + shadcn/ui (Tailwind) |
| Backend | NestJS + TypeScript + Prisma ORM |
| Base de datos | PostgreSQL (plugin Railway) |
| Cola | Redis + BullMQ (plugin Railway) |
| Storage | MinIO (imagen Docker en Railway) |
| Auth | JWT local (`LOCAL_AUTH=true`) — no Cognito |
| Deploy | Railway — monorepo con `--path-as-root` por servicio |

## Comandos de desarrollo

```bash
# Backend
cd backend
npm run start:dev       # puerto 3001
npm run build
npm run lint
npx prisma generate
npx prisma db push      # aplica schema sin migraciones (dev/staging)
npx prisma studio       # UI para explorar la BD

# Frontend
cd frontend
npm run dev             # puerto 5173
npm run build
npm run lint
```

## Variables de entorno importantes

### Backend (`.env`)
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
LOCAL_AUTH=true
CORS_ORIGIN=https://informes.elementalpro.cl

# MinIO
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
S3_ENDPOINT=http://<minio-private-domain>:9000
S3_PUBLIC_ENDPOINT=https://<minio-public-domain>
S3_FORCE_PATH_STYLE=true
S3_BUCKET_PHOTOS=elemental-photos
S3_BUCKET_PDFS=elemental-pdfs
```

### Frontend (`.env`)
```
VITE_API_URL=https://backend-production-c31d.up.railway.app/api
VITE_AUTH_MODE=local
```

> `VITE_*` se hornean en el bundle en tiempo de build (Docker ARG). Si se cambian hay que redesplegar.

## Estructura del proyecto

```
prueba/
├── backend/
│   ├── src/
│   │   ├── app.module.ts          # módulo raíz
│   │   ├── main.ts                # bootstrap, CORS, helmet, rate-limit
│   │   ├── auth/                  # JWT local + Cognito (deshabilitado)
│   │   ├── users/
│   │   ├── companies/
│   │   ├── services/              # entidad principal (órdenes de trabajo)
│   │   ├── photos/                # presign S3, confirm, delete
│   │   ├── pdfs/                  # generación con Puppeteer via BullMQ
│   │   ├── storage/               # StorageInitService: crea buckets al arrancar
│   │   └── prisma/
│   ├── prisma/schema.prisma
│   ├── Dockerfile
│   └── railway.toml
├── frontend/
│   ├── src/
│   │   ├── store/authStore.ts     # Zustand — maneja login/token
│   │   ├── api/                   # clientes axios por recurso
│   │   ├── pages/
│   │   └── components/
│   └── Dockerfile
├── docker-compose.local.yml       # desarrollo local completo
└── RAILWAY.md                     # guía de deploy paso a paso
```

## Modelo de datos (Prisma)

- `User` — roles: `ADMIN` | `TECHNICIAN`
- `Company` + `Location` — clientes con sucursales
- `Service` — orden de trabajo (entidad principal, soft delete con `deletedAt`)
- `ServicePhoto` — fotos `BEFORE` / `AFTER` en MinIO
- `ServicePdf` — PDFs generados async, estados: `PENDING → PROCESSING → READY | ERROR`

## Deploy en Railway

```bash
# Subir backend
railway service link backend
railway up backend --path-as-root

# Subir frontend
railway service link frontend
railway up frontend --path-as-root

# Ver logs
railway service link backend && railway logs --tail 50
```

### Variables de referencia Railway (resolución en runtime)
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
S3_ENDPOINT=http://${{minio.RAILWAY_PRIVATE_DOMAIN}}:9000
CORS_ORIGIN=https://informes.elementalpro.cl
```

## URLs de producción

| Servicio | URL |
|---|---|
| Frontend | `https://informes.elementalpro.cl` |
| Backend API | `https://backend-production-c31d.up.railway.app/api` |
| Health check | `https://backend-production-c31d.up.railway.app/api/health` |

## Crear primer usuario admin

```bash
curl -X POST https://backend-production-c31d.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa.com","name":"Admin","password":"Password123!","role":"ADMIN"}'
```

## Gotchas conocidos

- **`prisma db push` en vez de `migrate deploy`**: el repo no tiene archivos de migración SQL (solo `.gitkeep`). Se usa `db push --accept-data-loss` en el CMD del Dockerfile y en `railway.toml`.
- **Buckets MinIO auto-creados**: `StorageInitService` los crea al arrancar via `OnModuleInit`. No hace falta crearlos manualmente.
- **`VITE_API_URL` bakeado en build**: si cambia el dominio del backend, hay que redesplegar el frontend con la nueva variable.
- **CORS solo acepta un origen**: `CORS_ORIGIN` es un string único. Si hay que aceptar varios dominios, modificar `main.ts` para parsear lista separada por coma.
- **MinIO en Railway requiere `PORT=9000`**: Railway necesita saber en qué puerto escucha el contenedor.
- **Rate limit**: 100 req / 15 min por IP. Ajustar en `main.ts` si es necesario.
