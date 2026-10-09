# Despliegue en AWS Lightsail

Guía para pasar Elemental Pro de Railway a una instancia de AWS Lightsail **sin dejar de dar servicio**: Railway sigue funcionando hasta que se cambie el DNS.

## Arquitectura

```
Internet ──► Caddy (HTTPS automático, :443)
               ├── /api/*  ──► backend (NestJS + worker PDF con Chromium)
               └── /*      ──► frontend (Nginx con el build de React)

backend ──► PostgreSQL (contenedor)   backend ──► Redis (cola de PDFs)
backend / navegador ──► Amazon S3 (fotos y PDFs, buckets privados, URLs firmadas)
```

- **Instancia Lightsail**: Ubuntu 24.04, plan de 2 GB de RAM (~12 USD/mes) + 2 GB de swap.
- **Amazon S3** en lugar de MinIO: MinIO dejó de publicar sus imágenes Docker, así que no se puede instalar ni actualizar de forma confiable. Con ~1 GB/mes, S3 cuesta unos centavos al mes.
- Solo los puertos 80/443 quedan abiertos. Postgres y Redis no son accesibles desde Internet.

**Costo estimado:** ~12 USD (instancia) + ~2–3 USD (snapshots) + <1 USD (S3) ≈ **15 USD/mes**.

## 1. Crear los recursos de S3 (una vez)

En la consola de AWS, abrir **CloudShell** (ícono `>_` arriba a la derecha), subir `scripts/create-aws-resources.sh` y ejecutar:

```bash
DOMAIN=informes.elementalpro.cl BUCKET_PREFIX=elementalpro-informes AWS_REGION=us-east-1 \
  bash create-aws-resources.sh
```

Crea los dos buckets privados (cifrado, versionado y CORS) y un usuario IAM que **solo** puede leer y escribir en esos buckets. Al final imprime 5 líneas para el `.env`: guardarlas, porque la clave secreta se muestra una sola vez.

## 2. Crear la instancia Lightsail

1. Lightsail → **Create instance** → región `us-east-1` (la misma de S3) → **Linux/Unix → OS Only → Ubuntu 24.04 LTS**.
2. Plan: **2 GB RAM** (ver la tabla de precios vigente en la consola).
3. **Networking → Create static IP** y asociarla a la instancia (gratis mientras esté asociada).
4. **Networking → IPv4 Firewall**: dejar SSH (22), HTTP (80) y HTTPS (443).
5. **Snapshots → Enable automatic snapshots** (respaldo diario del disco completo).

## 3. Preparar el servidor

Conectarse por SSH (botón *Connect* en Lightsail) y ejecutar:

```bash
git clone https://github.com/<usuario>/<repo>.git elemental
cd elemental
git checkout aws-lightsail
sudo bash deploy/lightsail/scripts/setup-server.sh
exit   # volver a entrar para que el usuario quede en el grupo docker
```

## 4. Configurar y levantar

```bash
cd elemental/deploy/lightsail
cp .env.example .env
nano .env     # completar: claves con `openssl rand -hex 32` + las 5 líneas de S3 del paso 1
```

Mientras el DNS siga apuntando a Railway, Caddy **no** puede obtener el certificado para `informes.elementalpro.cl`. Para probar antes del cambio, usar un subdominio de prueba (por ejemplo `nuevo.elementalpro.cl` → IP de Lightsail):

1. Poner `DOMAIN=nuevo.elementalpro.cl` en el `.env`.
2. Agregar `https://nuevo.elementalpro.cl` a `AllowedOrigins` del CORS de los buckets (o volver a ejecutar el paso 1 con ese dominio).

```bash
docker compose up -d --build
docker compose ps            # todos "running"/"healthy"
docker compose logs -f backend
```

## 5. Migrar los datos desde Railway

Railway **no se modifica**: el script solo lee. Se puede repetir las veces que se quiera (cada ejecución reemplaza los datos de Lightsail por los de Railway).

Datos necesarios del dashboard de Railway:

| Variable | Dónde está en Railway |
|---|---|
| `RAILWAY_DATABASE_URL` | Postgres → Variables → `DATABASE_PUBLIC_URL` |
| `RAILWAY_S3_URL` | Servicio minio → Settings → dominio público (`https://...`) |
| `RAILWAY_S3_KEY` / `RAILWAY_S3_SECRET` | backend → Variables → `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |

```bash
export RAILWAY_DATABASE_URL='postgresql://...'
export RAILWAY_S3_URL='https://...'
export RAILWAY_S3_KEY='...'
export RAILWAY_S3_SECRET='...'
bash scripts/migrate-from-railway.sh
```

Al final muestra una tabla comparando la cantidad de registros de Railway y de Lightsail. Todas las filas deben decir `OK`.

**No hay que reescribir URLs**: las fotos y los PDFs se sirven con URLs firmadas que se generan a partir de la ruta del archivo (`s3Key`), que se mantiene igual.

## 6. Cambio definitivo (corte)

1. Avisar a los usuarios que no carguen servicios durante ~30 minutos.
2. Ejecutar de nuevo el paso 5, para traer lo último de Railway.
3. En el DNS, apuntar `informes.elementalpro.cl` a la IP estática de Lightsail.
4. En el `.env`, `DOMAIN=informes.elementalpro.cl` y luego `docker compose up -d`.
5. Probar: iniciar sesión, ver fotos antiguas, descargar un PDF antiguo, crear un servicio con fotos y generar su PDF.
6. En **Empresas**, configurar el día de corte del informe mensual de cada institución (ej. Tierra Amarilla = 13). Railway no tiene ese dato, así que la copia los deja en 1. También revisar **Mi perfil** (teléfono) de cada usuario.
7. Mantener Railway algunos días como respaldo. **Volver atrás** = apuntar el DNS de nuevo a Railway.

> Las sesiones abiertas en Railway no sirven en Lightsail (el `JWT_SECRET` es distinto): los usuarios deben iniciar sesión de nuevo.

## Operación diaria

| Tarea | Comando (desde `deploy/lightsail/`) |
|---|---|
| Ver estado | `docker compose ps` |
| Ver logs | `docker compose logs -f backend` |
| Actualizar a una nueva versión | `git pull && docker compose up -d --build` |
| Crear un administrador | `docker compose exec -e ADMIN_EMAIL=a@b.cl -e ADMIN_NAME="Nombre" -e ADMIN_PASSWORD='Clave-123' backend node dist/scripts/create-admin.js` |
| Respaldo manual de la BD | `docker compose exec -T db sh -c 'pg_dump -U $POSTGRES_USER -Fc $POSTGRES_DB' > backups/manual.dump` |
| Restaurar un respaldo | `docker compose stop backend && docker compose exec -T db sh -c 'pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists --no-owner' < backups/db-AAAAMMDD-HHMM.dump && docker compose start backend` |

### Respaldos

- **Base de datos**: el servicio `backup` hace un `pg_dump` diario en `backups/` y conserva 14 días.
- **Disco completo**: snapshots automáticos de Lightsail (paso 2).
- **Fotos y PDFs**: S3 con versionado; un archivo borrado se puede recuperar durante 30 días.

### Migraciones de base de datos

El backend ejecuta `prisma migrate deploy` al arrancar (`backend/docker-entrypoint.sh`). Ya no se usa `prisma db push --accept-data-loss`, que podía borrar columnas con datos. Para cambiar el esquema en desarrollo:

```bash
cd backend
npx prisma migrate dev --name descripcion_del_cambio   # genera prisma/migrations/<fecha>_descripcion
```

Revisar el SQL generado y hacer commit. Se aplica solo en el próximo deploy.
