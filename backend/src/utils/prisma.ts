import { PrismaClient } from '@prisma/client';

// Singleton pattern for PrismaClient to prevent connection pool exhaustion
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.DATABASE_URL;
const hasConnectionLimit = Boolean(databaseUrl && /[?&]connection_limit=/.test(databaseUrl));
const prismaUrl =
  databaseUrl && !hasConnectionLimit
    ? `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}connection_limit=${
        process.env.PRISMA_CONNECTION_LIMIT ?? '10'
      }&pool_timeout=${process.env.PRISMA_POOL_TIMEOUT ?? '60'}`
    : databaseUrl;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: prismaUrl
      ? {
          db: {
            url: prismaUrl,
          },
        }
      : undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
