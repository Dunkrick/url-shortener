# URL Shortener

A lightweight URL shortening service built from scratch in Go and PostgreSQL, containerized with Docker, deployed on Google Cloud Run, and evolving incrementally toward a distributed backend system.

## Current Status

**Version:** v1.1.0 — Performance Hardening + Production Redis

The service is deployed on Google Cloud Run with PostgreSQL on Cloud SQL and Redis through Google Cloud Memorystore.

Recent engineering work:

- Added PostgreSQL connection pooling with `pgxpool`
- Load-tested the redirect path with k6
- Identified and fixed a database concurrency bottleneck
- Improved concurrent throughput to **135.5 req/s with 100% successful requests** on the PostgreSQL-backed implementation
- Added Redis cache-aside reads to the redirect path
- Added Redis fallback to PostgreSQL on cache misses
- Configured managed Redis connectivity through Cloud Run VPC networking
- Deployed the Redis-backed application to production
- Added production Cloud SQL connectivity through the Cloud SQL Unix socket
- Added environment-based production configuration

The service currently supports:

- Creating short URLs
- PostgreSQL persistence
- Deterministic Base62 short codes
- Redis-backed redirect caching
- HTTP redirects
- Duplicate URL handling
- JSON-based HTTP API
- Dockerized local development
- Production deployment on Google Cloud Run

## Architecture

### Local

```text
Client
  |
  | HTTP
  v
Go HTTP Server
  |
  +---- POST /api/v1/urls
  |         |
  |         v
  |     PostgreSQL
  |         |
  |         v
  |        ID
  |         |
  |         v
  |      Base62
  |
  +---- GET /<short_code>
            |
            v
        Base62 Decode
            |
            v
          Redis
            |
       +----+----+
       |         |
     HIT        MISS
       |         |
       |         v
       |     PostgreSQL
       |         |
       +----<----+
            |
            v
       Original URL
            |
            v
       HTTP 302 Redirect
```

### Production

```text
                       Internet
                          |
                          v
                   Google Cloud Run
                     Go instances
                          |
              +-----------+-----------+
              |                       |
              v                       v
       Memorystore Redis         Cloud SQL
        Cache-aside layer       PostgreSQL
              |                       |
              +-----------+-----------+
                          |
                          v
                    URL Redirect
```

The application is designed to remain stateless. PostgreSQL is the source of truth for URL mappings, while Redis is used as a performance optimization for frequently accessed redirects.

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
  "short_url": "http://localhost:8080/1"
}
```

### Redirect

```http
GET /1
```

The service decodes the Base62 short code and checks Redis first.

On a cache hit, the original URL is returned directly from Redis.

On a cache miss, the service queries PostgreSQL, stores the result in Redis, and then responds with an HTTP redirect.

## Data Model

```text
urls
-------------------------
id          BIGSERIAL PRIMARY KEY
long_url    TEXT NOT NULL UNIQUE
created_at  TIMESTAMPTZ NOT NULL
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

This means the short code does not need to be stored separately.

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
short_code -> long_url
```

with a **1-hour TTL**.

Redis is not the source of truth. If the cached value is unavailable, the application falls back to PostgreSQL.

This allows the cache layer to improve redirect performance without making the application dependent on Redis for correctness.

## Production Deployment

The production architecture uses:

- **Google Cloud Run** for the Go application
- **Cloud SQL for PostgreSQL** for persistent storage
- **Memorystore for Redis** for redirect caching
- **Cloud Run VPC networking** for private Redis connectivity
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

Local secrets are kept in `.env` and excluded from version control.

Production secrets should be managed through a dedicated secrets-management solution rather than committed to source control.

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
│   └── performance-investigation.md
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

The service derives public short codes from database IDs using Base62.

This keeps the implementation simple and avoids storing redundant information.

### Duplicate URLs

`long_url` has a unique constraint.

When the same URL is submitted again, the existing record is returned rather than creating another short URL.

### Database-level uniqueness

The application does not rely on a check-then-insert pattern to enforce uniqueness.

PostgreSQL owns the invariant through the unique constraint and `ON CONFLICT` handling.

### Redis as a cache

Redis is treated as a performance layer rather than the source of truth.

A Redis failure or cache miss should not make stored URLs unavailable because PostgreSQL remains the authoritative datastore.

### Environment-based configuration

Runtime configuration is supplied through environment variables rather than being hardcoded into the application.

## Testing & Performance

Basic validation:

```bash
go test ./...
go vet ./...
```

The service has also been manually verified through HTTP requests using `curl`.

### PostgreSQL-only baseline

The initial load test of the redirect path achieved:

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
Throughput: +13.8%
Average latency: -11.6%
P50 latency:     -12.0%
P95 latency:     -23.6%
```

The purpose of these measurements is not simply to optimize a benchmark, but to establish a baseline that can be compared against future architectural changes.

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

### V1.2 — Production Hardening

- Unit and integration tests
- Structured logging
- Better request validation
- Graceful shutdown
- Application metrics
- Secret Manager integration
- Cache hit/miss metrics
- Production observability

### V1.3 — Horizontal Scaling

- Multiple Cloud Run instances
- Stateless application instances
- Shared Redis and PostgreSQL state
- Measure behavior across instances
- Load testing under concurrent traffic
- Failure testing of individual application instances

### V1.4 — Distributed Rate Limiting

- Redis-backed rate limiting
- Atomic counters
- Per-client/request limits
- Rate-limit headers
- Behavior under multiple application instances

## Engineering Goal

This project is intentionally being developed incrementally.

Each version introduces new infrastructure only when the existing system presents a problem worth solving.

The goal is to use the project to study backend engineering, distributed systems, scalability, reliability, observability, and performance through measurable iterations:

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
