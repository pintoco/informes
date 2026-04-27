# Deploy en Railway

Railway reemplaza docker-compose en producción: mismos contenedores, sin gestionar servidores.

## Servicios que se crean en Railway

| Servicio Railway | Qué es |
|---|---|
| `backend` | NestJS API (tu Dockerfile) |
| `frontend` | React + nginx (tu Dockerfile) |
| `postgres` | Plugin oficial de Railway |
| `redis` | Plugin oficial de Railway |
| `minio` | Contenedor MinIO con volumen |

---

## Paso a paso

### 1. Instalar Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### 2. Crear proyecto

```bash
railway init
# Nombre: elemental-pro
```

### 3. Agregar plugins de base de datos

En el dashboard de Railway (railway.app), dentro de tu proyecto:
- Click **New** → **Database** → **PostgreSQL** → crear
- Click **New** → **Database** → **Redis** → crear

Railway inyectará `DATABASE_URL` y `REDIS_URL` automáticamente a los servicios que lo necesiten.

### 4. Desplegar MinIO

```bash
# Desde la carpeta del repo
railway service create --name minio
railway variables set \
  MINIO_ROOT_USER=minioadmin \
  MINIO_ROOT_PASSWORD=minioadmin123 \
  --service minio

# Configurar el Dockerfile inline con imagen de MinIO
# En el dashboard: Settings → Source → Docker Image
# Image: minio/minio
# Start command: server /data --console-address ":9001"
# Port: 9000
# Agregar un Volume en: /data
```

O desde el dashboard:
1. **New Service** → **Docker Image** → `minio/minio`
2. **Variables**: `MINIO_ROOT_USER=minioadmin`, `MINIO_ROOT_PASSWORD=minioadmin123`
3. **Start Command**: `server /data --console-address ":9001"`
4. **Volumes**: agregar volumen montado en `/data`
5. Exponer puerto `9000` (y opcionalmente `9001` para consola)

Después de crear MinIO, crea los buckets:
```bash
# Con la CLI de mc (desde tu máquina local apuntando a la URL pública de MinIO en Railway)
export MINIO_URL=https://<tu-minio-railway-url>
mc alias set railway $MINIO_URL minioadmin minioadmin123
mc mb railway/elemental-photos
mc mb railway/elemental-pdfs
mc anonymous set download railway/elemental-pdfs
```

### 5. Desplegar Backend

```bash
cd backend
railway service create --name backend
```

En el dashboard del servicio `backend`:
- **Source**: conecta tu repo GitHub → root directory `/backend`
- Railway detectará el `Dockerfile` automáticamente

#### Variables del backend en Railway

Ve a **Variables** del servicio `backend` y agrega:

```
NODE_ENV=production
PORT=3001
LOCAL_AUTH=true
JWT_SECRET=<genera-uno-con: openssl rand -base64 32>
JWT_EXPIRES_IN=7d

# Railway inyecta DATABASE_URL y REDIS_URL automáticamente si están en el mismo proyecto

# MinIO
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
S3_ENDPOINT=http://${{minio.RAILWAY_PRIVATE_DOMAIN}}:9000
S3_PUBLIC_ENDPOINT=https://${{minio.RAILWAY_PUBLIC_DOMAIN}}
S3_FORCE_PATH_STYLE=true
S3_BUCKET_PHOTOS=elemental-photos
S3_BUCKET_PDFS=elemental-pdfs

# CORS — se actualiza después de crear el frontend
CORS_ORIGIN=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

> **Nota**: `${{minio.RAILWAY_PUBLIC_DOMAIN}}` es la sintaxis de Railway para referenciar variables de otro servicio. Railway las resuelve automáticamente.

### 6. Desplegar Frontend

```bash
cd frontend
railway service create --name frontend
```

En el dashboard del servicio `frontend`:
- **Source**: repo GitHub → root directory `/frontend`
- Railway detectará el `Dockerfile`

#### Variables del frontend en Railway

```
VITE_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api
VITE_AUTH_MODE=local
```

> Las variables `VITE_*` se usan como **Build Args** porque están bakeadas en el bundle de React en tiempo de compilación.
> En Railway, ve a **Variables** → actívalas como **Build Variables** también.

---

## Variables de referencia entre servicios (Railway feature)

Railway permite que un servicio lea variables de otro:

```
# En el backend, para referenciar el dominio de MinIO:
S3_ENDPOINT=http://${{minio.RAILWAY_PRIVATE_DOMAIN}}:9000

# En el frontend, para apuntar al backend:
VITE_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api
```

Estas referencias se resuelven automáticamente en el dashboard.

---

## URLs resultantes

Después del deploy tendrás algo así:

| Servicio | URL |
|---|---|
| Frontend | `https://elemental-frontend-production.up.railway.app` |
| Backend | `https://elemental-backend-production.up.railway.app/api` |
| MinIO API | `https://elemental-minio-production.up.railway.app` |

---

## Dominio personalizado (opcional)

Railway te permite conectar un dominio propio gratis:
1. Dashboard → tu servicio frontend → **Settings** → **Domains** → **Custom Domain**
2. Agrega tu dominio y configura el CNAME como te indica Railway

---

## Costos aproximados en Railway

| Recurso | Plan Hobby ($5/mes) |
|---|---|
| Backend (NestJS) | ~$3-5/mes (512 MB RAM) |
| Frontend (nginx) | ~$1-2/mes (muy liviano) |
| PostgreSQL | $5/mes incluido en el plan |
| Redis | $5/mes incluido en el plan |
| MinIO | ~$3-5/mes + storage |
| **Total estimado** | **~$15-20/mes** |

El **Plan Hobby** de Railway cuesta $5/mes e incluye $5 de créditos. Para este stack necesitarás el plan de pago.

---

## Checklist antes de subir a Railway

- [ ] Generar `JWT_SECRET` seguro: `openssl rand -base64 32`
- [ ] Crear los buckets en MinIO después de que el servicio suba
- [ ] Verificar que `CORS_ORIGIN` apunte al dominio del frontend
- [ ] Verificar que `VITE_API_URL` apunte al dominio del backend
- [ ] Crear primer usuario admin via curl/Postman:
  ```bash
  curl -X POST https://<backend-url>/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@empresa.com","name":"Admin","password":"TuPassword123!","role":"ADMIN"}'
  ```

---

## Auto-deploy desde GitHub

Una vez conectado el repo, Railway hace rebuild automático en cada `git push origin main`. No es necesario usar `railway up` habitualmente.

Para configurarlo en un servicio nuevo:
1. Dashboard → servicio → **Settings** → **Source**
2. **Connect Repo** → seleccionar el repositorio GitHub
3. **Root Directory**: `/backend` o `/frontend` según el servicio
4. **Branch**: `main`

A partir de ahí, cada push dispara el rebuild del servicio correspondiente.

---

## Comandos útiles con Railway CLI

```bash
# Ver logs del backend
railway logs --service backend --tail 50

# Abrir consola de la BD
railway connect postgres

# Ver todas las variables
railway variables --service backend

# Redeploy manual (cuando el auto-deploy no alcanza)
railway redeploy --service backend
railway redeploy --service frontend
```
