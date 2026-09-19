# URL Shortener

A production-deployed URL shortening service built from scratch in Go, PostgreSQL, and Redis, evolving incrementally toward a distributed backend system.

## Current Status

**Version:** v1.2.0 — Distributed Rate Limiting

The service is deployed on Google Cloud Run with PostgreSQL on Cloud SQL and Redis through Google Cloud Memorystore.

### Live Service

```text
https://url-shortener-902490290476.asia-south1.run.app
```

### Current capabilities

- Create short URLs
- PostgreSQL persistence
- Deterministic Base62 short codes
- Duplicate URL handling
- Redis cache-aside redirect caching
- Distributed rate limiting
- HTTP 302 redirects
- Dockerized local development
- Production deployment on Google Cloud Run
- Horizontally scalable stateless application instances
- System-design documentation

### Recent engineering work

- Added PostgreSQL connection pooling with `pgxpool`
- Load-tested the redirect path with k6
- Identified and fixed a database concurrency bottleneck
- Added Redis cache-aside reads to the redirect path
- Deployed managed Redis through Google Cloud Memorystore
- Configured Cloud Run VPC connectivity to Redis
- Added production Cloud SQL connectivity through the Cloud SQL Unix socket
- Added a Redis-backed distributed rate limiter
- Verified the rate limiter locally and in production
- Documented the system architecture, trade-offs, failure scenarios, and scaling strategy

## Architecture

### Request flow

```text
                         Client
                           |
              +------------+------------+
              |                         |
              v                         v
       POST /api/v1/urls          GET /:shortCode
              |                         |
              v                         v
       Redis Rate Limiter          Base62 Decode
              |                         |
              v                         v
         PostgreSQL                  Redis
              |                    /        \
              v                  HIT        MISS
          Base62 ID                 |          |
              |                     |          v
              v                     |      PostgreSQL
         Short Code                 |          |
              |                     |          v
              +---------------------+      Redis SET
                                            |
                                            v
                                      Original URL
                                            |
                                            v
                                      HTTP 302
```

### Production architecture

```text
                         Internet
                            |
                            v
                    Google Cloud Run
                 Stateless Go instances
                    /       |       \
                   /        |        \
                  v         v         v
             Instance A  Instance B  Instance C
                  |         |         |
                  +---------+---------+
                            |
                +-----------+-----------+
                |                       |
                v                       v
        Memorystore Redis         Cloud SQL
        Cache + Rate Limit        PostgreSQL
```

The Go application is stateless. Persistent URL mappings live in PostgreSQL, while Redis provides shared caching and rate-limiting state.

This allows multiple Cloud Run instances to serve requests without maintaining application state locally.

## Tech Stack

- **Go 1.27**
- **PostgreSQL 18**
- **Redis 7**
- **pgx/v5 + pgxpool** — PostgreSQL driver and connection pooling
- **go-redis/v9** — Redis client
- **Docker / Docker Compose**
- **Google Cloud Run**
- **Google Cloud SQL**
- **Google Cloud Memorystore**
- **Base62 encoding**
- **k6** — load testing

## API

### Create a short URL

```http
POST /api/v1/urls
Content-Type: application/json
```

Request:

```json
{
  "url": "https://example.com"
}
```

Response:

```json
{
  "short_url": "https://url-shortener-902490290476.asia-south1.run.app/1"
}
```

URL creation is rate-limited to **100 requests per minute per client IP**.

Requests exceeding the limit receive:

```text
HTTP 429 Too Many Requests
```

### Redirect

```http
GET /1
```

The service decodes the Base62 short code and checks Redis first.

On a cache hit, the original URL is retrieved directly from Redis.

On a cache miss, the service queries PostgreSQL, stores the result in Redis, and responds with an HTTP 302 redirect.

## Data Model

```text
urls
-------------------------
id          BIGSERIAL PRIMARY KEY
long_url    TEXT NOT NULL UNIQUE
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

The database-generated `id` acts as the internal identifier.

The public short code is derived from the ID:

```text
database ID
     |
     v
  Base62
     |
     v
short code
```

The short code therefore does not need to be stored separately.

PostgreSQL owns ID generation and database-level uniqueness.

## Key Generation

The service uses PostgreSQL-generated IDs and converts them to Base62.

```text
PostgreSQL ID → Base62 → Short Code
```

Advantages:

- Uniqueness is delegated to PostgreSQL.
- IDs are deterministic.
- No collision detection is required.
- No separate sequence or ID service is necessary.
- The implementation remains simple.

Trade-offs:

- IDs are predictable.
- The short code reveals approximate creation order/volume.
- Base62 encoding is not encryption.

## Redis Cache

The redirect path uses a cache-aside strategy:

```text
GET /<short_code>
       |
       v
   Base62 decode
       |
       v
   Redis GET
       |
   +---+---+
   |       |
  HIT     MISS
   |       |
   |       v
   |   PostgreSQL
   |       |
   |       v
   |    Redis SET
   |       |
   +---<---+
       |
       v
   HTTP 302
```

Redis stores:

```text
short_code → long_url
```

with a **1-hour TTL**.

Redis is not the source of truth. If a cached value is unavailable, the redirect path can fall back to PostgreSQL.

This keeps correctness in PostgreSQL while using Redis to reduce repeated database reads.

## Distributed Rate Limiting

URL creation uses a Redis-backed fixed-window rate limiter.

### Limit

```text
100 requests / minute / client IP
```

The counter is stored in Redis using a key based on the client IP and current minute:

```text
rate_limit:create:<client-ip>:<window>
```

Redis `INCR` provides an atomic counter, while the first request in a window sets a 60-second expiration.

### Why Redis?

Cloud Run can run multiple application instances.

An in-memory counter would be isolated to each instance:

```text
Instance A → Counter A
Instance B → Counter B
Instance C → Counter C
```

A client could therefore distribute requests across instances and bypass the intended global limit.

Redis provides shared state:

```text
Instance A ─┐
Instance B ─┼──→ Redis Counter
Instance C ─┘
```

### Why only rate-limit URL creation?

The redirect path is the primary read-heavy workload.

Applying the same limit to redirects would unnecessarily interfere with the workload the system is optimized to serve.

### Trade-off

The current implementation uses a fixed-window algorithm.

A fixed window can permit a burst around a window boundary—for example, requests at the end of one minute followed by another burst at the beginning of the next.

More advanced algorithms such as token bucket or sliding-window rate limiting could be introduced later if required.

## Production Deployment

The production architecture uses:

- **Google Cloud Run** for the Go application
- **Cloud SQL for PostgreSQL** for persistent storage
- **Memorystore for Redis** for caching and rate-limiting state
- **Cloud Run VPC networking** for Redis connectivity
- **Cloud SQL Unix socket** for database connectivity

Runtime configuration is supplied through environment variables:

```text
APP_BASE_URL
PORT
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
REDIS_ADDR
```

Secrets are kept outside source control.

## Local Development

### Prerequisites

- Go
- Docker
- Git

### Run with Docker Compose

```bash
docker compose up --build
```

The application is exposed at:

```text
http://localhost:8080
```

### Create a short URL

```bash
curl -X POST http://localhost:8080/api/v1/urls \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com"}'
```

Example response:

```json
{
  "short_url": "http://localhost:8080/1"
}
```

### Follow the redirect

```bash
curl -i http://localhost:8080/1
```

Expected behavior:

```text
HTTP/1.1 302 Found

Location: https://github.com
```

## Project Structure

```text
.
├── main.go
├── base62.go
├── init.sql
├── load-test.js
├── docs/
│   ├── performance-investigation.md
│   └── system-design.md
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── .gitignore
├── go.mod
└── go.sum
```

## Design Decisions

### PostgreSQL-generated IDs

PostgreSQL owns the generation of unique row identifiers and enforces database-level uniqueness.

### Base62 short codes

Public short codes are derived from database IDs using Base62.

This avoids storing redundant short-code data and removes the need for collision detection.

### Duplicate URLs

`long_url` has a unique constraint.

When the same URL is submitted again, the existing record is returned rather than creating another mapping.

### Database-level uniqueness

The application does not rely on a check-then-insert pattern.

PostgreSQL owns the invariant through the unique constraint and `ON CONFLICT` handling.

### Redis as a cache

Redis is treated as a performance layer rather than the source of truth.

A cache miss does not affect correctness because PostgreSQL remains authoritative.

### Stateless application instances

The Go service does not store application state in memory that must be shared between instances.

Shared state lives in PostgreSQL and Redis, allowing Cloud Run to scale application instances horizontally.

## Testing & Performance

The service has been validated through:

- `go build ./...`
- `go vet ./...`
- HTTP integration checks using `curl`
- Redis behavior inspection
- 101-request rate-limit verification
- Production deployment verification
- k6 load testing

### PostgreSQL-only baseline

The initial redirect-path load test achieved:

```text
Throughput: 135.5 req/s
Average:     72.68 ms
Median:      68.97 ms
P90:         88.34 ms
P95:         99.53 ms
Errors:       0%
```

### Redis-backed implementation

The same workload with Redis caching achieved:

```text
Throughput: 154.3 req/s
Average:     64.25 ms
Median:      60.68 ms
P90:         71.62 ms
P95:         76.07 ms
Errors:       0%
```

Observed improvement:

```text
Throughput:       +13.8%
Average latency:  -11.6%
P50 latency:      -12.0%
P95 latency:      -23.6%
```

The purpose of these measurements is to establish a baseline that can be compared against future architectural changes.

## System Design

A more detailed discussion of the architecture, scaling model, caching strategy, rate limiting, failure scenarios, bottlenecks, and future improvements is available in:

```text
docs/system-design.md
```

## Roadmap

The system is being evolved incrementally rather than introducing distributed infrastructure prematurely.

### V1.1 — Performance Hardening + Production Redis ✓

- PostgreSQL connection pooling
- k6 load testing
- Performance baseline
- Redis cache-aside reads
- Redis fallback to PostgreSQL
- Managed Redis deployment
- Cloud Run VPC connectivity
- Cloud SQL production deployment
- Production redirect path

### V1.2 — Distributed Rate Limiting ✓

- Redis-backed rate limiting
- Atomic counters
- Per-client limits
- Fixed-window enforcement
- Behavior verified across production deployment

### V1.3 — Production Hardening

- Unit and integration tests
- Structured logging
- Better request validation
- Graceful shutdown
- Application metrics
- Secret Manager integration
- Cache hit/miss metrics
- Production observability

### V1.4 — Horizontal Scaling Experiments

- Multiple Cloud Run instances
- Stateless application instances
- Shared Redis and PostgreSQL state
- Concurrent load testing
- Failure testing of individual application instances

### Future

- Analytics/event processing
- Kafka or another event streaming system
- PostgreSQL read replicas
- Database sharding
- Advanced rate-limiting algorithms
- URL expiration
- Custom aliases

## Engineering Approach

This project is intentionally developed incrementally.

Each version introduces new infrastructure when the existing system presents a problem worth solving.

```text
Build
  ↓
Measure
  ↓
Observe a bottleneck
  ↓
Diagnose
  ↓
Change the architecture
  ↓
Measure again
  ↓
Test failure behavior
  ↓
Scale
```

The URL shortener is the workload. The engineering evolution is the project.
