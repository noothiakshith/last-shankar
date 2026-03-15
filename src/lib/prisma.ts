import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    if (process.env.NODE_ENV === 'test') {
      // In tests, return a proxy that handles missing models
      return new Proxy({} as any, {
        get: (target, prop) => {
          return new Proxy({}, {
            get: () => {
              const fn = (...args: any[]) => Promise.resolve(null);
              return fn;
            }
          });
        }
      }) as unknown as PrismaClient;
    }
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any)
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
