#!/usr/bin/env bash
# ============================================================
# Copia TODOS los datos de Railway (Postgres + fotos/PDFs de MinIO) a Lightsail + S3.
# Railway NO se modifica: solo se lee. Se puede repetir las veces que haga falta
# (cada ejecución reemplaza la base de datos de Lightsail por la de Railway).
#
# Uso (en el servidor Lightsail, desde deploy/lightsail/):
#   export RAILWAY_DATABASE_URL='postgresql://...'        # Railway → Postgres → DATABASE_PUBLIC_URL
#   export RAILWAY_S3_URL='https://<minio-publico-railway>'
#   export RAILWAY_S3_KEY='...'                            # AWS_ACCESS_KEY_ID del backend en Railway
#   export RAILWAY_S3_SECRET='...'                         # AWS_SECRET_ACCESS_KEY del backend en Railway
#   bash scripts/migrate-from-railway.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

: "${RAILWAY_DATABASE_URL:?Definir RAILWAY_DATABASE_URL}"
: "${RAILWAY_S3_URL:?Definir RAILWAY_S3_URL}"
: "${RAILWAY_S3_KEY:?Definir RAILWAY_S3_KEY}"
: "${RAILWAY_S3_SECRET:?Definir RAILWAY_S3_SECRET}"

[ -f .env ] || { echo "Falta deploy/lightsail/.env"; exit 1; }
set -a; . ./.env; set +a
DB_USER="${DB_USER:-elemental}"
DB_NAME="${DB_NAME:-elemental_pro}"

TS=$(date +%Y%m%d-%H%M%S)
mkdir -p backups

echo "⚠️  Esto REEMPLAZA la base de datos de Lightsail con la de Railway."
if [ "${1:-}" != "--yes" ]; then
  read -r -p "¿Continuar? (escribir 'si'): " answer
  [ "$answer" = "si" ] || { echo "Cancelado."; exit 1; }
fi

echo "==> 1/6 Levantando servicios de datos y deteniendo el backend"
docker compose up -d db redis
docker compose stop backend || true

if docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc 'SELECT 1 FROM "Service" LIMIT 1' >/dev/null 2>&1; then
  echo "==> Respaldo previo de la BD de Lightsail → backups/lightsail-before-migration-$TS.dump"
  docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "backups/lightsail-before-migration-$TS.dump"
fi

echo "==> 2/6 Exportando base de datos de Railway"
docker run --rm -v "$PWD/backups:/backups" postgres:17-alpine \
  pg_dump "$RAILWAY_DATABASE_URL" -Fc --no-owner --no-acl -f "/backups/railway-$TS.dump"
ls -lh "backups/railway-$TS.dump"

echo "==> 3/6 Restaurando en Lightsail"
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
docker compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --exit-on-error \
  < "backups/railway-$TS.dump"

echo "==> 4/6 Copiando fotos y PDFs: MinIO de Railway → disco → Amazon S3"
# Las keys (rutas) se conservan, así que coinciden con s3Key en la base de datos.
# Las URLs se firman al vuelo desde s3Key: no hay que reescribir URLs en la BD.
FILES_DIR="$PWD/backups/files-$TS"
mkdir -p "$FILES_DIR"
copy_bucket() {
  local railway_bucket="$1" s3_bucket="$2"
  echo "--- $railway_bucket → s3://$s3_bucket"
  # Descargar desde el MinIO de Railway
  docker run --rm -v "$FILES_DIR:/data" \
    -e AWS_ACCESS_KEY_ID="$RAILWAY_S3_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$RAILWAY_S3_SECRET" \
    -e AWS_DEFAULT_REGION=us-east-1 \
    amazon/aws-cli s3 sync "s3://$railway_bucket" "/data/$railway_bucket" \
    --endpoint-url "$RAILWAY_S3_URL" --only-show-errors

  # Subir a S3 (S3_ENDPOINT solo se usa en pruebas locales con un S3 compatible)
  local endpoint_args=()
  [ -n "${S3_ENDPOINT:-}" ] && endpoint_args=(--endpoint-url "$S3_ENDPOINT")
  docker run --rm -v "$FILES_DIR:/data" --network "${S3_DOCKER_NETWORK:-bridge}" \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    -e AWS_DEFAULT_REGION="${AWS_REGION:-us-east-1}" \
    amazon/aws-cli s3 sync "/data/$railway_bucket" "s3://$s3_bucket" \
    "${endpoint_args[@]}" --only-show-errors
  echo "    $(find "$FILES_DIR/$railway_bucket" -type f | wc -l) archivos copiados"
}
copy_bucket "${RAILWAY_BUCKET_PHOTOS:-elemental-photos}" "$S3_BUCKET_PHOTOS"
copy_bucket "${RAILWAY_BUCKET_PDFS:-elemental-pdfs}" "$S3_BUCKET_PDFS"

echo "==> 5/6 Iniciando backend (aplica migraciones pendientes sobre los datos restaurados)"
docker compose up -d backend
for i in $(seq 1 30); do
  if docker compose exec -T backend wget -qO- http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 4
done
docker compose logs --tail 20 backend

echo "==> 6/6 Verificación de registros"
count() {
  local railway lightsail
  railway=$(docker run --rm postgres:17-alpine psql "$RAILWAY_DATABASE_URL" -tAc "SELECT count(*) FROM \"$1\"")
  lightsail=$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM \"$1\"")
  printf '  %-14s Railway: %-6s Lightsail: %-6s %s\n' "$1" "$railway" "$lightsail" \
    "$([ "$railway" = "$lightsail" ] && echo OK || echo '⚠️ DIFERENTE')"
}
for t in User Company Location Service ServicePhoto ServicePdf; do count "$t"; done

docker compose up -d
echo
echo "✅ Migración completada. Railway sigue funcionando sin cambios."
echo "   Copia local de los archivos en $FILES_DIR (se puede borrar tras verificar)."
echo "   Revisar la app en https://$DOMAIN antes de cambiar el DNS definitivo."
