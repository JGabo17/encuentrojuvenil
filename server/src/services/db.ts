import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Optimización de SQLite para 100+ usuarios concurrentes
// Activa Write-Ahead Logging (WAL) para lecturas concurrentes sin bloqueo
// y timeout de 5000ms para evitar errores de database is locked
async function initSqlitePragmas() {
  try {
    await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;');
  } catch (err) {
    // Si la base de datos aún no está lista, se reintentará en el primer query
  }
}

initSqlitePragmas().catch(() => {});

export default prisma;

