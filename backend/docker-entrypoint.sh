#!/bin/sh
# Arranque del backend: aplica migraciones versionadas y luego inicia la API.
# Reemplaza a `prisma db push --accept-data-loss`, que podía borrar columnas con datos.
set -e

echo "[entrypoint] Revisando historial de migraciones..."
if node dist/scripts/needs-baseline.js; then
  # La BD ya tiene tablas (creada con db push o restaurada desde Railway) pero no
  # historial: se marca la migración inicial como aplicada (baseline).
  echo "[entrypoint] BD existente sin historial: marcando 0_init como aplicada (baseline)"
  npx prisma migrate resolve --applied 0_init
fi

echo "[entrypoint] Aplicando migraciones..."
npx prisma migrate deploy

exec node dist/main
