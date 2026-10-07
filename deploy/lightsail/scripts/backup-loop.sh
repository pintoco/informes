#!/bin/sh
# Respaldo diario de PostgreSQL. Lo ejecuta el servicio `backup` de docker-compose.
# Conserva 14 días de respaldos en deploy/lightsail/backups/.

while true; do
  file="/backups/db-$(date +%Y%m%d-%H%M).dump"
  if pg_dump -Fc -f "$file"; then
    echo "[backup] OK $file"
  else
    echo "[backup] FALLÓ $file"
    rm -f "$file"
  fi
  find /backups -name 'db-*.dump' -mtime +14 -delete
  sleep 86400
done
