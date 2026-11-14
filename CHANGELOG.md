# Changelog

## v2.1.0 — Serverless Database Support & Resilient Redis Fallback

### Added

- Added support for `DATABASE_URL` connection strings in `connectDB()`, enabling zero-config integration with serverless PostgreSQL providers such as Neon.
- Added support for `REDIS_URL` connection strings with automatic TLS (`rediss://`) and authentication parsing via `redis.ParseURL()`, enabling integration with serverless Redis providers such as Upstash.
- Added graceful Redis fallback: if Redis is unconfigured, unreachable, or times out on ping, the application logs a warning and boots safely in PostgreSQL-only mode rather than terminating the server.
- Handled `nil` Redis state in `allowRequest` (permits creation requests), `redirectHandler` (queries PostgreSQL directly), `incrementRedirectCount` (no-op), and `statsHandler` (returns total of 0).

### Infrastructure

- Migrated cloud infrastructure from Google Cloud SQL and Google Cloud Memorystore to serverless equivalents (Neon for PostgreSQL, Upstash for Redis) to achieve zero idle cost ($0/month).

---

## v2.0.0 — Redis Cache

### Added

- Added Redis 7 to the Docker Compose development stack.
- Added `go-redis/v9` as the Redis client.
- Added a Redis client to the application server.
- Added cache-aside behavior to the redirect path.
- Added a 1-hour TTL for cached short-code → long-URL entries.

### Behavior

- Redis HIT: redirect directly from the cached URL.
- Redis MISS: query PostgreSQL, populate Redis, then redirect.
- Redis unavailable: fall back to PostgreSQL.
- PostgreSQL remains the source of truth.

### Performance

Using the same 10-VU / 30-second k6 workload as the previous version:

- Throughput: 135.5 → 154.3 req/s (+13.8%).
- Average latency: 72.68 → 64.25 ms (-11.6%).
- p50 latency: 68.97 → 60.68 ms (-12.0%).
- p95 latency: 99.53 → 76.07 ms (-23.6%).
- Error rate remained at 0%.

### Verification

Cache hit and miss behavior was verified using Redis MONITOR. The miss path populated Redis, and subsequent requests were served from the cached value.

### Next

V2.5 will introduce multiple stateless application instances behind a load balancer and verify that shared Redis/PostgreSQL state continues to work correctly under horizontal scaling.
