import { PrismaClient } from '@prisma/client';

// Singleton pattern for PrismaClient to prevent connection pool exhaustion
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.DATABASE_URL;
const hasConnectionLimit = Boolean(databaseUrl && /[?&]connection_limit=/.test(databaseUrl));

function buildPrismaUrl(base: string): string {
  const sep = base.includes('?') ? '&' : '?';
  const params: string[] = [];
  if (!hasConnectionLimit) {
    // Keep pool small — AWS RDS free/small tier has very limited max_connections (~17-66).
    // Multiple processes (ts-node restarts, multiple terminals) can exhaust the limit quickly.
    params.push(`connection_limit=${process.env.PRISMA_CONNECTION_LIMIT ?? '3'}`);
  }
  if (!/[?&]pool_timeout=/.test(base)) {
    params.push(`pool_timeout=${process.env.PRISMA_POOL_TIMEOUT ?? '30'}`);
  }
  if (!/[?&]connect_timeout=/.test(base)) {
    params.push(`connect_timeout=${process.env.PRISMA_CONNECT_TIMEOUT ?? '15'}`);
  }
  if (!/[?&]socket_timeout=/.test(base)) {
    params.push(`socket_timeout=${process.env.PRISMA_SOCKET_TIMEOUT ?? '30'}`);
  }
  return params.length > 0 ? `${base}${sep}${params.join('&')}` : base;
}

const prismaUrl = databaseUrl ? buildPrismaUrl(databaseUrl) : databaseUrl;

const clientInstance =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: prismaUrl
      ? {
          db: {
            url: prismaUrl,
          },
        }
      : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Middleware: auto-retry transient connection errors once before propagating
clientInstance.$use(async (params, next) => {
  try {
    return await next(params);
  } catch (err: unknown) {
    const errMsg = String((err as { message?: string })?.message ?? '').toLowerCase();
    const code = String((err as { code?: string })?.code ?? '');
    const isTransient =
      ['P1001', 'P1017', 'P2024', 'P1008'].includes(code) ||
      errMsg.includes('connection reset') ||
      errMsg.includes('connectionreset') ||
      errMsg.includes('econnreset') ||
      errMsg.includes('server has closed') ||
      errMsg.includes('socket hang up') ||
      errMsg.includes('timed out');
    if (isTransient) {
      // Wait 500ms then retry once
      await new Promise((resolve) => setTimeout(resolve, 500));
      return await next(params);
    }
    throw err;
  }
});

export const prisma = clientInstance;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = clientInstance;

// Release all connections cleanly on process exit so RDS slots are freed immediately
const gracefulDisconnect = () => {
  clientInstance.$disconnect().catch(() => {});
};
process.once('SIGINT', gracefulDisconnect);
process.once('SIGTERM', gracefulDisconnect);
process.once('beforeExit', gracefulDisconnect);
