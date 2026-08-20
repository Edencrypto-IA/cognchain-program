import { PrismaClient } from '@prisma/client'
import { PrismaClient as SqlitePrismaClient } from '@/generated/sqlite'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  sqlitePrisma: SqlitePrismaClient | undefined
}

/**
 * Offline-first database selection.
 *  - DATABASE_PROVIDER=sqlite  → SQLite local (desktop/100% offline)
 *  - DATABASE_PROVIDER postgres (ou DATABASE_URL definida) → Postgres (Railway)
 *  - Sem provider e sem URL → SQLite local por padrão.
 */
function isSqliteMode(): boolean {
  const provider = process.env.DATABASE_PROVIDER?.trim().toLowerCase()
  if (provider === 'sqlite') return true
  if (provider && provider !== '') return false
  return !process.env.DATABASE_URL
}

export const isSqlite = isSqliteMode()

if (isSqlite && !process.env.DATABASE_URL) {
  // Arquivo local (gitignored), resolvido relativo a prisma/ → db/congchain-offline.db
  process.env.DATABASE_URL = 'file:../db/congchain-offline.db'
}

function logConfig(): Array<'query' | 'warn' | 'error'> {
  return process.env.DEBUG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error']
}

const sqliteClient = globalForPrisma.sqlitePrisma ?? new SqlitePrismaClient({ log: logConfig() })
const postgresClient = globalForPrisma.prisma ?? new PrismaClient({ log: logConfig() })

// Both clients expose the same models; the union is cast to the Postgres type
// for ergonomics — runtime behaviour follows isSqlite.
export const db: PrismaClient = isSqlite
  ? (sqliteClient as unknown as PrismaClient)
  : postgresClient

if (process.env.NODE_ENV !== 'production') {
  if (isSqlite) globalForPrisma.sqlitePrisma = sqliteClient
  else globalForPrisma.prisma = postgresClient
}
