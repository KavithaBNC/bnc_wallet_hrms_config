import { PrismaClient } from '@prisma/config-client';

// Singleton pattern for Config DB PrismaClient
const globalForConfigPrisma = globalThis as unknown as {
  configPrisma: PrismaClient | undefined;
};

const configDatabaseUrl = process.env.CONFIG_DATABASE_URL;

function buildConfigPrismaUrl(base: string): string {
  const sep = base.includes('?') ? '&' : '?';
  const params: string[] = [];
  if (!/[?&]connection_limit=/.test(base)) {
    params.push(`connection_limit=${process.env.CONFIG_PRISMA_CONNECTION_LIMIT ?? '7'}`);
  }
  if (!/[?&]pool_timeout=/.test(base)) {
    params.push(`pool_timeout=${process.env.CONFIG_PRISMA_POOL_TIMEOUT ?? '30'}`);
  }
  if (!/[?&]connect_timeout=/.test(base)) {
    params.push(`connect_timeout=15`);
  }
  if (!/[?&]socket_timeout=/.test(base)) {
    params.push(`socket_timeout=60`);
  }
  return params.length > 0 ? `${base}${sep}${params.join('&')}` : base;
}

const configPrismaUrl = configDatabaseUrl ? buildConfigPrismaUrl(configDatabaseUrl) : configDatabaseUrl;

const clientInstance =
  globalForConfigPrisma.configPrisma ??
  new PrismaClient({
    datasources: configPrismaUrl
      ? {
          db: {
            url: configPrismaUrl,
          },
        }
      : undefined,
    log: ['error', 'warn'],
  });

// Middleware: auto-retry transient connection errors once
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
      await new Promise((resolve) => setTimeout(resolve, 500));
      return await next(params);
    }
    throw err;
  }
});

export const configPrisma = clientInstance;

if (process.env.NODE_ENV !== 'production') globalForConfigPrisma.configPrisma = clientInstance;

const gracefulDisconnect = () => {
  clientInstance.$disconnect().catch(() => {});
};
process.once('SIGINT', gracefulDisconnect);
process.once('SIGTERM', gracefulDisconnect);
process.once('beforeExit', gracefulDisconnect);
