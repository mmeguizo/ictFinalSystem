import { PrismaClient } from '@prisma/client';

// Singleton Prisma Client to avoid multiple instances
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, use a global variable to preserve the client across hot reloads
  const globalWithPrisma = global as typeof globalThis & {
    prisma: PrismaClient;
  };

  if (!globalWithPrisma.prisma) {
    globalWithPrisma.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }

  prisma = globalWithPrisma.prisma;
}

export { prisma };
