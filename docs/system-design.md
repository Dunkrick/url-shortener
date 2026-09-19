# URL Shortener — System Design

## 1. Requirements

### Functional

- Create a short URL
- Redirect a short URL to its original URL

### Non-functional

- Read-heavy workload
- Low redirect latency
- No short-code collisions
- Horizontally scalable
- Highly available redirect path

## 2. Traffic Assumptions

The system is expected to be read-heavy, with an example 100:1 redirect-to-create ratio.

This influences the architecture:

- Optimize the redirect path for reads.
- Cache frequently accessed URLs.
- Keep the write path simple and strongly consistent.

## 3. API Design

### Create URL

`POST /api/v1/urls`

Creates a short URL for a given long URL.

### Redirect

`GET /:shortCode`

Redirects the client to the original long URL.

## 4. Data Model

PostgreSQL is the source of truth.

```sql
urls (
    id BIGSERIAL PRIMARY KEY,
    long_url TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

The `UNIQUE` constraint on `long_url` ensures that the same long URL maps to the same database record.

## 5. Key Generation

The database generates a unique numeric ID using `BIGSERIAL`.

The application converts this ID into Base62:

PostgreSQL ID → Base62 → short code

Why?

- Uniqueness is delegated to PostgreSQL.
- IDs are deterministic.
- No collision detection is required.
- The implementation remains simple.

Trade-offs:

- IDs are predictable.
- The short code reveals approximate creation order/volume.
- Base62 encoding is not encryption.

## 6. Read Path

The redirect path uses a cache-aside strategy:

Client
→ Go service
→ Redis
→ PostgreSQL on cache miss

On a cache hit, the original URL is returned directly from Redis.

On a cache miss, PostgreSQL is queried and the result is stored in Redis for subsequent requests.

Redis is therefore an optimization, not the source of truth.

## 7. Write Path

`POST /api/v1/urls`

Client
→ Go service
→ PostgreSQL
→ Base62 encoding
→ short URL response

PostgreSQL handles ID generation and uniqueness.

## 8. Caching

### Why Redis?

Redirect traffic is expected to dominate creation traffic. Caching avoids repeatedly querying PostgreSQL for popular URLs.

### Why cache-aside?

The application explicitly checks Redis first and falls back to PostgreSQL when the value is absent.

This keeps the database authoritative while allowing Redis to reduce read load.

### Why TTL?

Cached URLs use a 1-hour TTL.

This prevents entries from remaining in Redis indefinitely and provides a simple cache lifecycle.

## 9. Rate Limiting

URL creation is rate-limited to 100 requests per minute per client IP.

The rate limiter uses Redis because Cloud Run can run multiple stateless instances.

An in-memory counter would be local to each instance:

Instance A → counter A
Instance B → counter B
Instance C → counter C

This could allow a client to effectively bypass the intended global limit by reaching different instances.

Redis provides shared state:

Instance A ─┐
Instance B ─┼→ Redis counter
Instance C ─┘

The implementation uses a fixed-window counter with Redis `INCR` and a 60-second expiration.

### Trade-off

A fixed window can allow a burst around a minute boundary, for example, requests at the end of one window and the beginning of the next.

The rate limit is applied to URL creation rather than redirects because redirects are the read-heavy path the system is designed to optimize.

## 10. Horizontal Scaling

The Go application is stateless, allowing Cloud Run to run multiple instances.

Each instance shares:

- PostgreSQL for persistent state
- Redis for caching and rate-limiting state

Therefore:

Client
→ Cloud Run
├── Instance A ─┐
├── Instance B ─┼→ Redis
└── Instance C ─┴→ PostgreSQL

Adding instances does not require moving application state between servers.

## 11. Failure Scenarios

### Redis unavailable

Redis is not the source of truth for URLs.

For the redirect path, the application can fall back to PostgreSQL when the cache cannot be used.

However, Redis is also used by the rate limiter, so rate limiting currently depends on Redis availability.

### PostgreSQL unavailable

URL creation cannot succeed because PostgreSQL is the source of truth.

A redirect may still succeed when the requested URL is already present in Redis.

### Instance failure

Because application state is not stored in the Go process, another Cloud Run instance can handle subsequent requests.

### Cache miss

The application queries PostgreSQL and repopulates Redis.

### Rate limiter unavailable

The current implementation returns `503 Service Unavailable` because the application cannot reliably enforce the configured limit without Redis.

## 12. Bottlenecks

At higher traffic levels, likely bottlenecks include:

1. PostgreSQL write capacity
2. PostgreSQL connection capacity
3. Redis throughput/memory
4. Cloud Run instance capacity
5. Hot URLs causing concentrated cache traffic

The current architecture is intentionally simple and designed to provide a foundation for measuring where the next bottleneck actually appears.

## 13. Future Architecture

Potential extensions include:

- Analytics/event processing
- Kafka or another event streaming system
- PostgreSQL read replicas
- Database sharding
- More advanced rate-limiting algorithms
- Observability and metrics
- URL expiration
- Custom aliases
