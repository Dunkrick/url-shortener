# Implementation notes

Rough record of what I built and what I measured.

## Build notes

- Started with a Go HTTP API and PostgreSQL URL table.
- PostgreSQL generates numeric IDs. Go converts each ID to Base62 for the short code.
- Added a unique constraint on `long_url`; duplicate submissions reuse the existing mapping.
- Added Redis cache-aside lookup for redirects, with a one-hour cache TTL.
- Added a Redis fixed-window creation limit: 100 requests per minute per client IP.
- Added aggregate redirect count in Redis and exposed it through `GET /api/v1/stats`.
- Built frontend with React, TypeScript, and Vite. Its stats view polls every five seconds.
- Used Docker Compose for local PostgreSQL, Redis, and API setup.
- Deployed frontend to Vercel and API to Cloud Run, with Cloud SQL and Memorystore. Vercel rewrites send API and short-code requests to the Go service.

## Local development

From project root, start backend services:

```bash
docker compose up --build
```

Run frontend separately:

```bash
cd frontend
npm install
npm run dev -- --port 5175
```

For local frontend-to-API requests, use this in `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

## Benchmark notes

Recorded k6 comparison for the tested redirect workload:

| Metric          | PostgreSQL only |  With Redis |
| --------------- | --------------: | ----------: |
| Throughput      |     135.5 req/s | 154.3 req/s |
| Average latency |        72.68 ms |    64.25 ms |
| P50 latency     |        68.97 ms |    60.68 ms |
| P90 latency     |        88.34 ms |    71.62 ms |
| P95 latency     |        99.53 ms |    76.07 ms |
| Errors          |              0% |          0% |

With Redis, throughput was about 13.8% higher and P95 latency about 23.6% lower in this run. These numbers depend on the tested setup and workload.

## Current limits / next work

- Rate limiting trusts first `X-Forwarded-For` value. Public Cloud Run access means callers may spoof it.
- Redirect stats are aggregate only; no per-URL analytics.
- Redirect count is stored in Redis, so key loss can reset it.
- Fixed-window rate limiting allows bursts at minute boundaries.
- Add more unit and integration coverage, structured logs/monitoring, and safer client-IP handling.
