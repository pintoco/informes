#!/bin/sh
# Arranque del backend: aplica migraciones versionadas y luego inicia la API.
# Reemplaza a `prisma db push --accept-data-loss`, que podía borrar columnas con datos.
set -e

echo "[entrypoint] Aplicando migraciones..."
if ! OUTPUT=$(npx prisma migrate deploy 2>&1); then
  echo "$OUTPUT"
  # P3005: la BD ya tiene tablas (creada antes con db push o restaurada desde Railway)
  # pero no historial de migraciones → se marca la migración inicial como aplicada.
  if echo "$OUTPUT" | grep -q "P3005"; then
    echo "[entrypoint] BD existente sin historial: marcando 0_init como aplicada (baseline)"
    npx prisma migrate resolve --applied 0_init
    npx prisma migrate deploy
  else
    exit 1
  fi
else
  echo "$OUTPUT"
fi

exec node dist/main
