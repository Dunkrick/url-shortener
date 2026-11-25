import { Pool } from 'pg'

let pool: Pool | null = null
let initPromise: Promise<void> | null = null

function buildConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const host = process.env.DB_HOST ?? 'localhost'
  const port = process.env.DB_PORT ?? '5432'
  const user = process.env.DB_USER ?? 'postgres'
  const password = process.env.DB_PASSWORD ?? 'postgres'
  const dbname = process.env.DB_NAME ?? 'url_shortener'

  return `postgres://${user}:${password}@${host}:${port}/${dbname}`
}

/**
 * Returns a shared PostgreSQL connection pool and ensures required tables exist.
 */
export async function getDb(): Promise<Pool> {
  if (!pool) {
    const connectionString = buildConnectionString()
    const useSsl =
      connectionString.includes('sslmode=require') ||
      connectionString.includes('.neon.tech')

    pool = new Pool({
      connectionString,
      max: 5,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    })
  }

  if (!initPromise) {
    initPromise = (async () => {
      await pool!.query(`
        CREATE TABLE IF NOT EXISTS urls (
          id BIGSERIAL PRIMARY KEY,
          long_url TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)
      await pool!.query(`
        CREATE TABLE IF NOT EXISTS stats (
          key TEXT PRIMARY KEY,
          value BIGINT NOT NULL DEFAULT 0
        );
      `)
    })().catch((err) => {
      initPromise = null
      throw err
    })
  }

  await initPromise
  return pool
}
