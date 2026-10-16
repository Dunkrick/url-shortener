# Implementation Notes

A running log of what I implemented, the decisions I made, and what
I verified while building Nip.

## 1. Basic URL shortener

Started with a Go API and PostgreSQL.

Implemented:

- `POST /api/v1/urls` to create a short URL.
- `GET /:shortCode` to redirect.
- PostgreSQL persistence.
- Base62 encoding of database IDs.
- Duplicate URL handling through a unique constraint.

### Decision: use database IDs for short codes

PostgreSQL generates the ID, and the application converts it to Base62.

This avoids needing a separate ID generator or collision-checking
mechanism. The trade-off is that short codes are predictable.

## 2. Add Redis caching

Added Redis to the redirect path using cache-aside.

The application checks Redis first. On a cache miss, it queries
PostgreSQL and caches the result for one hour.

PostgreSQL remains the source of truth.

### Why

Redirects are expected to be more frequent than URL creation.
Caching helps avoid repeated database reads for popular URLs.

## 3. Performance testing

Used k6 to compare the redirect path before and after Redis caching.

| Metric          | PostgreSQL only |  With Redis |
| --------------- | --------------: | ----------: |
| Throughput      |     135.5 req/s | 154.3 req/s |
| Average latency |        72.68 ms |    64.25 ms |
| P50 latency     |        68.97 ms |    60.68 ms |
| P90 latency     |        88.34 ms |    71.62 ms |
| P95 latency     |        99.53 ms |    76.07 ms |
| Errors          |              0% |          0% |

The tested workload showed a 13.8% throughput improvement and a
23.6% reduction in P95 latency.

These are the recorded test results, not a production performance
guarantee.

## 4. Add distributed rate limiting

Added a Redis-backed fixed-window rate limiter for URL creation.

The limit is 100 requests per minute per client IP.

Redis provides shared state across Cloud Run instances. The
implementation uses an atomic counter and a 60-second expiration.

I chose this over an in-memory counter because each application
instance would otherwise maintain a separate limit.

The trade-off is that fixed windows can allow bursts around window
boundaries.

The limit was tested locally and in production, including verification
that requests over the limit receive HTTP 429.

## 5. Deploy the backend

The Go API runs on Google Cloud Run.

PostgreSQL runs on Cloud SQL, and Redis runs on Google Cloud
Memorystore.

Production connectivity uses the configured Cloud SQL connection
and Cloud Run VPC access for Redis.

The application is stateless so Cloud Run can run multiple instances.

## 6. Add the frontend

Built the frontend using React, TypeScript, and Vite.

The frontend is hosted at:

https://drabnip.vercel.app

The Go API remains on Cloud Run:

https://url-shortener-902490290476.asia-south1.run.app

### CORS

The browser initially blocked frontend requests because the API did
not handle the CORS preflight request.

Added CORS middleware in Go to handle `OPTIONS` requests and allow
approved frontend origins.

The development origin and production origin need to match the
origins configured in the middleware.

## 7. Use Vercel for public short URLs

Configured Vercel rewrites to forward:

- `/api/*` requests to the corresponding Cloud Run API path.
- `/:shortCode` requests to the Go redirect handler.

Configured the backend's `APP_BASE_URL` to use:

`https://drabnip.vercel.app`

This lets the API return public URLs on the frontend domain without
moving the redirect logic out of Go.

The database mappings and Redis cache keys remain unchanged.

## 8. Add redirect statistics

Added:

`GET /api/v1/stats`

The endpoint returns the aggregate redirect count stored in Redis.

The counter increments for Redis cache hits and PostgreSQL fallback
redirects. Invalid codes and URLs that are not found are not counted.

The frontend requests the endpoint and displays the returned count.

This is not a full analytics system. The counter depends on Redis
and does not confirm that the browser completed the redirect.

## 9. Local development

The local Docker Compose setup starts:

- PostgreSQL
- Redis
- The Go API

Run:

```bash
docker compose up --build
```
