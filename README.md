# URL Shortener

A lightweight URL shortening service built from scratch in Go and PostgreSQL, containerized with Docker and designed to evolve into a scalable distributed system.

## Current Status

**Version:** v1.1.0 — Performance Hardening

The MVP is deployed on Google Cloud Run with PostgreSQL on Cloud SQL.

Recent engineering work includes:

- PostgreSQL connection pooling with `pgxpool`
- Concurrent load testing with k6
- Investigation and resolution of a database concurrency bottleneck
- Measured improvement from ~58 req/s failing under load to **135.5 req/s with 100% successful requests**
- Creating a short URL from a long URL
- Persisting URLs in PostgreSQL
- Deterministic Base62 short-code generation
- Redirecting short URLs to their original destinations
- Returning the same short URL for duplicate long URLs
- JSON-based HTTP API
- Dockerized local development

## Architecture

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
  |      ID
  |         |
  |         v
  |      Base62
  |
  +---- GET /:short_code
            |
            v
        Base62 Decode
            |
            v
        PostgreSQL
            |
            v
        Original URL
            |
            v
       HTTP 302 Redirect
```

## Tech Stack

- **Go 1.27**
- **PostgreSQL 18**
- **pgx/v5 + pgxpool** — PostgreSQL driver and connection pooling
- **Docker / Docker Compose**
- **Base62 encoding**

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

The service decodes the Base62 short code, retrieves the corresponding URL from PostgreSQL, and responds with an HTTP redirect.

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

This means the short code does not need to be stored separately in the MVP.

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

The MVP derives public short codes from database IDs using Base62.

This keeps the implementation simple and avoids storing redundant information.

### Duplicate URLs

`long_url` has a unique constraint.

When the same URL is submitted again, the existing record is returned rather than creating another short URL.

### Environment-based configuration

Environment variables are used for runtime configuration such as:

```text
APP_BASE_URL
PORT
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
```

Local secrets are kept in `.env` and excluded from version control.

## Testing & Performance

Basic validation:

```bash
go test ./...
go vet ./...
```

The MVP has also been manually verified through HTTP requests using `curl`.

## Roadmap

The MVP intentionally keeps the architecture simple.

Future versions will evolve the system incrementally:

### V2 — Production Hardening

- Unit and integration test suite
- Structured logging
- Better request validation
- Graceful shutdown
- Metrics
- Rate limiting
- Secrets management

### V3 — Performance

- Redis caching
- Cache-aside reads
- Cache invalidation
- Latency and throughput analysis

### V4 — Event-Driven Architecture

- Click events
- Kafka/Redpanda
- Asynchronous consumers
- Clickstream analytics
- Real-time analytics dashboard

### V5 — Distributed Scaling

- Multiple application instances
- Load balancing
- Distributed rate limiting
- Idempotency
- Failure handling

### V6 — Advanced Distributed Systems

- Database replication
- Consistency trade-offs
- Backpressure
- Retries and dead-letter queues
- Distributed tracing
- Failure and resilience testing

## Engineering Goal

This project is intentionally being developed incrementally.

Each version introduces new infrastructure only when the existing system presents a problem worth solving. The goal is to use the project to study backend engineering, distributed systems, scalability, reliability, observability, and performance through measurable iterations rather than adopting complexity prematurely.
