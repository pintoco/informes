/**
 * Crea (o promueve) un usuario ADMIN. Reemplaza al antiguo POST /auth/register público.
 *
 * Uso dentro del contenedor del backend:
 *   ADMIN_EMAIL=admin@empresa.cl ADMIN_NAME="Admin" ADMIN_PASSWORD='Clave-Segura-123' \
 *     node dist/scripts/create-admin.js
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador';
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Definir ADMIN_EMAIL y ADMIN_PASSWORD');
  }
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error('La contraseña debe tener 8+ caracteres, mayúscula, minúscula y número');
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN', passwordHash, passwordChangedAt: new Date(), deletedAt: null },
      });
      console.log(`Usuario existente ${existing.email} actualizado como ADMIN`);
    } else {
      await prisma.user.create({ data: { email, name, passwordHash, role: 'ADMIN' } });
      console.log(`ADMIN ${email} creado`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
