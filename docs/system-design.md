# System design

Short notes on how Nip is put together and why.

## Main pieces

```text
Browser
  -> Vercel frontend and rewrites
  -> Go HTTP API on Cloud Run
       -> PostgreSQL (Cloud SQL): URL source of truth
       -> Redis (Memorystore): cache, rate-limit state, redirect count
```

The frontend is hosted at `https://drabnip.vercel.app`. Vercel forwards API and short-code requests to the Go service. The backend uses `APP_BASE_URL` to build public short URLs.

## Creating a short URL

`POST /api/v1/urls` accepts a URL. The service checks the Redis creation limit, then PostgreSQL inserts the mapping or finds an existing mapping. PostgreSQL generates a `BIGSERIAL` ID; Go encodes it as Base62 and returns the short URL.

The `long_url` column has a unique constraint, so submitting the same URL reuses its mapping. Letting PostgreSQL own IDs and uniqueness keeps code generation simple. Codes are predictable and reveal approximate creation order; Base62 is encoding, not encryption.

## Redirects

`GET /:shortCode` decodes the code and checks Redis. On a miss, the service reads PostgreSQL and caches a found URL for one hour. It then returns HTTP `302`. PostgreSQL stays authoritative; Redis is a cache-aside performance layer.

The app is stateless, so Cloud Run can run multiple instances. Shared URL state lives in PostgreSQL and Redis.

## Rate limit

URL creation is limited to 100 requests per minute per client IP. Redis `INCR` and a 60-second expiry implement a fixed window shared across API instances. Fixed windows can allow bursts around a minute boundary. If Redis is unavailable, the rate-limiter path returns `503 Service Unavailable` rather than skipping the limit.

Client IP currently comes from the first `X-Forwarded-For` value. Since the Cloud Run service is publicly reachable, a direct caller may spoof that header and evade the intended per-IP limit.

## Redirect count

`GET /api/v1/stats` returns total redirects from a Redis counter. Successful redirect paths increment it for both cache hits and database fallbacks. Invalid or missing codes are not counted. It is one aggregate number, not per-URL analytics; losing the Redis counter key can reset the reported total.

## Failure cases and trade-offs

- Redis read failure can fall back to PostgreSQL for redirects. Rate limiting and stats still depend on Redis.
- PostgreSQL outage prevents new mappings. A redirect may still work if its URL is cached in Redis.
- Fixed-window limits are simple but permit boundary bursts.
- Redis caching lowers repeat database reads, but adds another service and its capacity limits.
- Likely pressure points at higher traffic: PostgreSQL writes/connections, Redis capacity, Cloud Run instances, and hot URLs.

## Possible next steps

Better IP extraction, per-URL analytics, stronger observability, more tests, expiration/custom aliases, and more advanced rate limiting are future work, not current features.
