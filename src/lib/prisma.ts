// src/lib/prisma.ts
//
// A single shared Prisma client instance. In Next.js dev mode, every file
// save triggers a hot-reload, which would create a new client (and a new
// DB connection pool) each time without this — so we stash it on
// globalThis and reuse it across reloads.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
