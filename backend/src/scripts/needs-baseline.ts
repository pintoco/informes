/**
 * Sale con código 0 si la BD ya tiene las tablas de la app pero no el historial de
 * migraciones de Prisma (BD creada con el antiguo `db push` o restaurada desde Railway).
 * En ese caso docker-entrypoint.sh marca `0_init` como aplicada antes de `migrate deploy`.
 *
 * "Sin historial" incluye una tabla `_prisma_migrations` sin ninguna migración terminada:
 * la BD de Railway la trae vacía, y un intento fallido de aplicar `0_init` sobre las
 * tablas existentes deja solo una fila sin `finished_at`.
 *
 * Se consulta directamente a Postgres porque la detección de "BD no vacía" de
 * `prisma migrate deploy` (P3005) no es confiable en todas las versiones de Postgres.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const [row] = await prisma.$queryRaw<{ has_history_table: boolean; has_tables: boolean }[]>`
      SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS has_history_table,
             to_regclass('public."User"') IS NOT NULL AS has_tables
    `;
    if (!row.has_tables) process.exit(1);
    if (!row.has_history_table) process.exit(0);

    const [{ applied }] = await prisma.$queryRaw<{ applied: number }[]>`
      SELECT count(*)::int AS applied FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    process.exit(applied === 0 ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
