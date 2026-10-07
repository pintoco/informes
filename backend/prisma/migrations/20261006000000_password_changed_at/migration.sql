-- Permite invalidar los JWT emitidos antes de un cambio de contraseña
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
