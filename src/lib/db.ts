import { PrismaClient } from '@prisma/client'
import { config } from '../config/index.js'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      config.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : config.NODE_ENV === 'test'
          ? ['error']
          : ['error'],
  })

if (config.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

export async function disconnectDb(): Promise<void> {
  await db.$disconnect()
}
