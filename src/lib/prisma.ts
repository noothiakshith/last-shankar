import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    if (process.env.NODE_ENV === 'test') {
      // In tests, return a proxy that returns empty results instead of null
      return new Proxy({} as any, {
        get: (target, prop) => {
          // Return a function that returns an empty array or object
          const fn = (...args: any[]) => {
            // For methods like findMany, findUnique, etc., return appropriate empty values
            const propStr = String(prop);
            if (propStr.includes('findMany') || propStr.includes('find')) {
              return Promise.resolve([]);
            }
            if (propStr.includes('create') || propStr.includes('update') || propStr.includes('delete')) {
              return Promise.resolve({ id: 'mock-id', ...args[0]?.data });
            }
            if (propStr.includes('count')) {
              return Promise.resolve(0);
            }
            return Promise.resolve(null);
          };
          
          // Return a nested proxy that returns functions
          return new Proxy({}, {
            get: () => fn
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
