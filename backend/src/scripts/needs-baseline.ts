/**
 * Sale con código 0 si la BD ya tiene las tablas de la app pero no el historial de
 * migraciones de Prisma (BD creada con el antiguo `db push` o restaurada desde Railway).
 * En ese caso docker-entrypoint.sh marca `0_init` como aplicada antes de `migrate deploy`.
 *
 * Se consulta directamente a Postgres porque la detección de "BD no vacía" de
 * `prisma migrate deploy` (P3005) no es confiable en todas las versiones de Postgres.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const [row] = await prisma.$queryRaw<{ has_history: boolean; has_tables: boolean }[]>`
      SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS has_history,
             to_regclass('public."User"') IS NOT NULL AS has_tables
    `;
    process.exit(row.has_tables && !row.has_history ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
