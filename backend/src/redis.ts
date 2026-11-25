import Redis from 'ioredis'

let redisClient: Redis | null = null
let initialized = false

/**
 * Returns an optional Redis client if REDIS_URL or REDIS_ADDR is configured
 * and reachable. Falls back to null so the app runs in PostgreSQL-only mode.
 */
export async function getRedis(): Promise<Redis | null> {
  if (initialized) {
    return redisClient
  }
  initialized = true

  const redisUrl = process.env.REDIS_URL
  const redisAddr = process.env.REDIS_ADDR

  if (!redisUrl && !redisAddr) {
    return null
  }

  try {
    const client = redisUrl
      ? new Redis(redisUrl, {
          connectTimeout: 3000,
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        })
      : new Redis({
          host: redisAddr!.split(':')[0],
          port: Number(redisAddr!.split(':')[1] || 6379),
          connectTimeout: 3000,
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        })

    await client.connect()
    await client.ping()
    redisClient = client
    return redisClient
  } catch (err) {
    console.warn('Redis unavailable, running in PostgreSQL-only mode:', err)
    return null
  }
}
