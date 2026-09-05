# Performance Investigation: Redis Caching

## Context

V2 adds Redis as a cache in front of PostgreSQL on the redirect path. The workload was kept the same as the previous benchmark: 10 VUs for 30 seconds against the local Docker Compose deployment.

## What changed

The redirect path now uses cache-aside behavior:

GET /<short_code>
→ Redis GET
→ cache hit: redirect immediately
→ cache miss: PostgreSQL lookup → Redis SET → redirect

PostgreSQL remains the source of truth. Redis is an optimization layer; Redis failures fall back to PostgreSQL.

## Benchmark

| Metric | PostgreSQL only | Redis cache | Change |
|---|---:|---:|---:|
| Throughput | 135.5 req/s | 154.3 req/s | +13.8% |
| Average latency | 72.68 ms | 64.25 ms | -11.6% |
| p50 | 68.97 ms | 60.68 ms | -12.0% |
| p95 | 99.53 ms | 76.07 ms | -23.6% |
| Error rate | 0% | 0% | unchanged |

## Interpretation

The cached version handled more requests per second while reducing latency. The largest improvement was at p95, showing a meaningful reduction in tail latency under the same workload.

The benchmark alone does not prove that every request was served from Redis. Redis MONITOR was used separately to verify cache behavior.

## Cache behavior verification

Redis MONITOR showed the application issuing `GET "1"` for a redirect request.

The cache-miss path was also tested by deleting the key and requesting the short code again. The expected sequence was observed:

Redis GET → PostgreSQL lookup → Redis SET → 302

A subsequent request used the cached value:

Redis GET → 302

## Engineering takeaway

Redis is useful here not simply because it supports fast reads, but because a cache hit avoids the PostgreSQL lookup entirely. This reduces database work and connection-pool usage for frequently accessed URLs.

The design also preserves correctness: PostgreSQL remains authoritative, so Redis failure degrades performance rather than making the cache the source of truth.

## V2 milestone

The redirect service now has a working cache-aside layer with measured performance improvement and verified hit/miss behavior.

Next version: introduce horizontal scaling and a load balancer.
