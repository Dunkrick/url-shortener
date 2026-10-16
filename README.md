# Nip — URL Shortener

Nip is a small URL shortener built to learn backend engineering. It creates short links, redirects visitors, and tracks an overall redirect count.

Live demo: [drabnip.vercel.app](https://drabnip.vercel.app)

## What it uses

- Go standard-library HTTP server for the API
- PostgreSQL for URL mappings and ID generation
- Redis for redirect caching, creation rate limits, and total redirect count
- React, TypeScript, and Vite for the frontend
- Docker Compose for local backend development
- Vercel for frontend hosting and request rewrites
- Google Cloud Run for the Go API; Cloud SQL and Memorystore for managed PostgreSQL and Redis
- k6 for the recorded load test

## Run locally

Requirements: Go, Docker with Docker Compose, Node.js, and npm.

Start PostgreSQL, Redis, and the API from the project root:

```bash
docker compose up --build
```

The API listens at `http://localhost:8080`.

To run the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev -- --port 5175
```

Set the frontend API address in `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Restart the Vite development server after changing the environment file.

## API examples

### Create short URL

`POST /api/v1/urls`

```bash
curl -i -X POST http://localhost:8080/api/v1/urls \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Example response (code is illustrative):

```json
{
  "short_url": "https://drabnip.vercel.app/1"
}
```

URL creation limit: 100 requests per minute per client IP. Requests over limit return `429 Too Many Requests`.

### Redirect

`GET /:shortCode` returns an HTTP `302` redirect. For example, visit `http://localhost:8080/1` if code `1` exists. The service checks Redis first, then PostgreSQL on cache miss.

### Total redirect count

`GET /api/v1/stats`

```json
{
  "total_redirects": 42
}
```

Example count is illustrative. This is an aggregate counter, not per-URL analytics.

## Benchmark

Recorded k6 results for tested workload:

| Metric          | PostgreSQL only |  With Redis |
| --------------- | --------------: | ----------: |
| Throughput      |     135.5 req/s | 154.3 req/s |
| Average latency |        72.68 ms |    64.25 ms |
| P50 latency     |        68.97 ms |    60.68 ms |
| P90 latency     |        88.34 ms |    71.62 ms |
| P95 latency     |        99.53 ms |    76.07 ms |
| Errors          |              0% |          0% |

These measurements describe that workload; they are not production guarantees.

## More notes

- [System design](docs/system-design.md)
- [Implementation notes](docs/implementation-notes.md)
