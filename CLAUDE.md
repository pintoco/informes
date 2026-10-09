# Elemental Pro — CLAUDE.md

Aplicación para registrar servicios técnicos de CCTV con carga de fotos y generación de PDFs.

> **Rama `aws-lightsail`**: versión endurecida para migrar a AWS Lightsail + S3 (ver `deploy/lightsail/README.md`).
> Producción sigue en Railway desde `main` hasta el corte. No hacer merge a `main` sin coordinar la migración.
>
> **Desplegado en AWS (cuenta 839911707830, `sa-east-1`)**, en paralelo a Railway:
> - Lightsail `elemental-pro` (2 GB, Ubuntu 24.04), IP estática `54.232.144.217`, snapshots diarios 07:00 UTC
> - URL de prueba: `https://54-232-144-217.sslip.io` (hasta cambiar el DNS de `informes.elementalpro.cl`)
> - S3: `elementalpro-informes-photos` / `elementalpro-informes-pdfs` (privados, versionados, CORS para ambos dominios)
> - IAM `elemental-pro-app`: solo lectura/escritura en esos buckets
> - Código en el servidor: `~/elemental` (rama `aws-lightsail`), config en `~/elemental/deploy/lightsail/.env`
> - Postgres 18 (igual que Railway). Para actualizar: `git pull && docker compose up -d --build`

## Stack actual (producción en Railway)

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript + shadcn/ui (Tailwind) |
| Backend | NestJS + TypeScript + Prisma ORM |
| Base de datos | PostgreSQL (plugin Railway) |
| Cola | Redis + BullMQ (plugin Railway) |
| Storage | MinIO (imagen Docker en Railway) |
| Auth | JWT local (`LOCAL_AUTH=true`) — no Cognito |
| Deploy | Railway — auto-deploy desde GitHub (`main` → rebuild automático) |

## Comandos de desarrollo

```bash
# Backend
cd backend
npm run start:dev       # puerto 3001
npm run build
npm run lint
npx prisma generate
npx prisma migrate dev --name <cambio>   # crea una migración versionada en prisma/migrations
npx prisma migrate deploy               # aplica migraciones pendientes
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
│   │   ├── auth/                  # JWT local (login; sin registro público)
│   │   ├── users/
│   │   ├── companies/
│   │   ├── services/              # entidad principal (órdenes de trabajo) + fotos (presign/confirm/delete)
│   │   ├── scripts/create-admin.ts # crea/promueve un ADMIN por CLI
│   │   ├── pdfs/                  # generación con Puppeteer via BullMQ
│   │   │   └── pdf-worker/templates/
│   │   │       ├── report.html.ts # plantilla HTML del PDF
│   │   │       └── logo.png       # logo Elemental (copiado a dist/ por NestJS assets)
│   │   ├── storage/               # StorageService (S3: URLs firmadas, get/put/delete) + StorageInitService
│   │   └── prisma/
│   ├── prisma/schema.prisma
│   ├── nest-cli.json              # assets: { include: "**/*.png" } → copia logo a dist/
│   ├── Dockerfile
│   └── railway.toml
├── frontend/
│   ├── public/
│   │   └── favicon.png            # favicon (logo Elemental orange)
│   ├── src/
│   │   ├── store/authStore.ts     # Zustand — maneja login/token
│   │   ├── api/                   # clientes axios por recurso
│   │   ├── pages/
│   │   └── components/
│   └── Dockerfile
├── docker-compose.local.yml       # desarrollo local completo (SeaweedFS como S3)
├── deploy/lightsail/              # producción en AWS Lightsail + S3 (compose, Caddy, scripts, guía)
└── RAILWAY.md                     # guía de deploy paso a paso
```

## Modelo de datos (Prisma)

- `User` — roles: `ADMIN` | `TECHNICIAN`
- `Company` + `Location` — clientes con sucursales
- `Service` — orden de trabajo (entidad principal, soft delete con `deletedAt`)
- `ServicePhoto` — fotos `BEFORE` / `AFTER` en MinIO
- `ServicePdf` — PDFs generados async, estados: `PENDING → PROCESSING → READY | ERROR`

## Deploy en Railway

El repo GitHub está conectado en el dashboard de Railway (Settings → Source) para ambos servicios. Cada push a `main` dispara el rebuild automático.

```bash
# Para forzar un redeploy manual desde CLI:
railway redeploy --service backend
railway redeploy --service frontend

# Ver logs
railway logs --service backend --tail 50
railway logs --service frontend --tail 50
```

> **Nota**: `railway up --path-as-root` requiere un argumento de path (`railway up .`). Con auto-deploy configurado rara vez es necesario usarlo.

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

En la rama `aws-lightsail` el registro público (`POST /auth/register`) fue eliminado. Los usuarios los crea un ADMIN desde la app (`POST /users`). Para el primer ADMIN:

```bash
docker compose exec -e ADMIN_EMAIL=admin@empresa.com -e ADMIN_NAME="Admin" \
  -e ADMIN_PASSWORD='Password123' backend node dist/scripts/create-admin.js
```

## Gotchas conocidos

- **Migraciones versionadas**: `backend/docker-entrypoint.sh` corre `prisma migrate deploy`. Si la BD ya tiene tablas sin historial (creada con el antiguo `db push` o restaurada desde Railway), marca `0_init` como aplicada (baseline) y sigue. Nunca volver a `db push --accept-data-loss`.
- **Buckets privados + URLs firmadas**: fotos y PDFs NO son públicos. `ServicesService.withSignedUrls` reemplaza `url` por una URL firmada temporal (`SIGNED_URL_TTL_SECONDS`, 2 h por defecto) en cada respuesta; la columna `url` en BD es solo referencia. Todo acceso a S3 pasa por `StorageService`.
- **Creación de buckets**: con `S3_INIT_BUCKETS` distinto de `false`, `StorageInitService` los crea y elimina cualquier política pública. En AWS (`false`) los crea `deploy/lightsail/scripts/create-aws-resources.sh`.
- **MinIO ya no publica imágenes Docker**: el desarrollo local usa SeaweedFS (`docker-compose.local.yml`) y Lightsail usa Amazon S3.
- **Plantilla PDF**: todo texto de usuario pasa por `esc()` en `report.html.ts`. Chromium corre sin JavaScript y con las peticiones de red bloqueadas. `firmaUrl` debe ser `data:image/png|jpeg;base64,...`.
- **Permisos**: eliminar servicios es solo para ADMIN. Cambiar la contraseña de un usuario invalida sus tokens (`passwordChangedAt`).
- **`trust proxy`**: `TRUST_PROXY` (default 1) permite que el rate limit vea la IP real detrás de Caddy/Railway.
- **`VITE_API_URL` bakeado en build**: si cambia el dominio del backend, hay que redesplegar el frontend con la nueva variable.
- **CORS**: `CORS_ORIGIN` acepta varios orígenes separados por coma.
- **MinIO en Railway requiere `PORT=9000`**: Railway necesita saber en qué puerto escucha el contenedor.
- **Rate limit**: `RATE_LIMIT_MAX` req / 15 min por IP (default 300); login: 10 intentos fallidos / 15 min.
- **Logo en PDF**: el archivo `logo.png` debe estar en `backend/src/pdfs/pdf-worker/templates/`. NestJS lo copia a `dist/` gracias a la config `assets` en `nest-cli.json`. La plantilla lo lee con `fs.readFileSync(path.join(__dirname, 'logo.png'))` al cargar el módulo. No usar base64 inline en el source TypeScript — Puppeteer falla silenciosamente con strings muy largos.
- **Zona horaria del PDF**: el servidor corre en UTC. Se usa `Intl.DateTimeFormat` con `timeZone: 'America/Santiago'` para mostrar hora chilena correcta (maneja DST automáticamente).
- **`fecha` del servicio**: se guarda como medianoche UTC del día elegido. Mostrarla con `parseServiceDate()` (frontend) o con métodos `getUTC*` (backend); `new Date(fecha)` en el navegador muestra el día anterior.
- **Campos opcionales en actualización**: al borrar un comentario (NVR, Cámaras, Observaciones) y guardar, el frontend envía `""` en edición. El backend lo convierte a `null` con `dto.campo || null` para limpiar el valor en BD. No omitir el campo (undefined) porque el servicio usa `!== undefined` para decidir qué actualizar.
- **Responsable desde el perfil**: al crear un servicio (o "Nueva visita a este punto"), `responsable`, `fono` y `email` los pone el backend desde el perfil del usuario conectado (`ServicesService.responsableFromProfile`; email = `contactEmail` o el de acceso) e ignora lo que mande el formulario. `nombreTecnico` es nullable: solo lo tienen servicios anteriores a 2026-10.
- **Textos predefinidos**: tabla `TextTemplate` (módulo `text-templates`). Las 6 iniciales se insertan en la migración `20261008000000_formulario_y_textos`, así que una BD restaurada desde Railway las recibe al aplicar migraciones.
- **PDF desactualizado**: se detecta comparando `Service.updatedAt` con el `createdAt` del último PDF. Subir/borrar fotos actualiza `updatedAt` (`touchService`).
