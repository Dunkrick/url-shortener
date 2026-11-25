import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { decodeBase62, encodeBase62 } from './base62.js'
import { getDb } from './db.js'
import { getRedis } from './redis.js'

const RATE_LIMIT_PER_MINUTE = 100

function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return 'unknown'
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false
  if (origin === 'https://drabnip.vercel.app' || origin.endsWith('.vercel.app')) {
    return true
  }
  return (
    origin === 'http://localhost:5173' ||
    origin === 'http://localhost:5175' ||
    origin === 'http://localhost:3000'
  )
}

async function allowRequest(clientIp: string): Promise<boolean> {
  const redis = await getRedis()
  if (!redis) {
    return true
  }

  const window = Math.floor(Date.now() / 1000 / 60)
  const key = `rate_limit:create:${clientIp}:${window}`
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, 60)
  }

  return count <= RATE_LIMIT_PER_MINUTE
}

async function incrementRedirectCount(): Promise<void> {
  const redis = await getRedis()
  if (redis) {
    try {
      await redis.incr('stats:total_redirects')
      return
    } catch (err) {
      console.warn('Failed to increment Redis redirect counter:', err)
    }
  }

  try {
    const db = await getDb()
    await db.query(`
      INSERT INTO stats (key, value) VALUES ('total_redirects', 1)
      ON CONFLICT (key) DO UPDATE SET value = stats.value + 1;
    `)
  } catch (err) {
    console.warn('Failed to increment PostgreSQL redirect counter:', err)
  }
}

export const app = new Hono()

app.use(
  '*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

app.post('/api/v1/urls', async (c) => {
  let body: { url?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.text('invalid request body', 400)
  }

  if (!body.url || typeof body.url !== 'string') {
    return c.text('url is required', 400)
  }

  const clientIp = getClientIp(c.req.raw.headers)
  try {
    const allowed = await allowRequest(clientIp)
    if (!allowed) {
      return c.text('rate limit exceeded', 429)
    }
  } catch {
    return c.text('rate limiting unavailable', 503)
  }

  try {
    const db = await getDb()
    const result = await db.query<{ id: string }>(
      `
      INSERT INTO urls (long_url)
      VALUES ($1)
      ON CONFLICT (long_url)
      DO UPDATE SET long_url = EXCLUDED.long_url
      RETURNING id
      `,
      [body.url],
    )

    const id = BigInt(result.rows[0].id)
    const shortCode = encodeBase62(id)
    const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:8080').replace(
      /\/+$/,
      '',
    )

    return c.json({ short_url: `${baseUrl}/${shortCode}` }, 201)
  } catch (err) {
    console.error('Failed to create URL:', err)
    return c.text('failed to create URL', 500)
  }
})

app.get('/api/v1/stats', async (c) => {
  let total = 0

  const redis = await getRedis()
  if (redis) {
    try {
      const value = await redis.get('stats:total_redirects')
      total = value ? Number(value) : 0
      return c.json({ total_redirects: total })
    } catch (err) {
      console.warn('Failed to retrieve stats from Redis:', err)
    }
  }

  try {
    const db = await getDb()
    const result = await db.query<{ value: string }>(
      `SELECT value FROM stats WHERE key = 'total_redirects';`,
    )
    if (result.rows.length > 0) {
      total = Number(result.rows[0].value)
    }
  } catch (err) {
    console.warn('Failed to retrieve stats from PostgreSQL:', err)
  }

  return c.json({ total_redirects: total })
})

app.get('/:shortCode', async (c) => {
  const shortCode = c.req.param('shortCode')
  if (!shortCode) {
    return c.text('short code is required', 400)
  }

  let id: bigint
  try {
    id = decodeBase62(shortCode)
  } catch {
    return c.text('invalid short code', 400)
  }

  const redis = await getRedis()
  if (redis) {
    try {
      const cachedUrl = await redis.get(shortCode)
      if (cachedUrl) {
        await incrementRedirectCount()
        return c.redirect(cachedUrl, 302)
      }
    } catch (err) {
      console.warn('Redis cache read failed:', err)
    }
  }

  try {
    const db = await getDb()
    const result = await db.query<{ long_url: string }>(
      `SELECT long_url FROM urls WHERE id = $1`,
      [id.toString()],
    )

    if (result.rows.length === 0) {
      return c.text('URL not found', 404)
    }

    const longUrl = result.rows[0].long_url

    if (redis) {
      await redis.set(shortCode, longUrl, 'EX', 3600).catch(() => {})
    }

    await incrementRedirectCount()
    return c.redirect(longUrl, 302)
  } catch (err) {
    console.error('Failed to resolve short code:', err)
    return c.text('URL not found', 404)
  }
})
