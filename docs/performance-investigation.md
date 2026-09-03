# Performance Investigation: PostgreSQL Connection Pooling

After shipping V1, I load-tested the redirect endpoint with **10 concurrent VUs for 30 seconds** using k6.

The first test exposed a concurrency issue: requests failed under load with `conn busy` errors. The root cause was a single `*pgx.Conn` being shared across concurrent HTTP requests.

I replaced it with `*pgxpool.Pool`, allowing requests to use multiple database connections concurrently.

### Result

| Metric          |    Before |           After |
| --------------- | --------: | --------------: |
| Request success |        0% |        **100%** |
| Throughput      | ~58 req/s | **135.5 req/s** |
| Median latency  |    ~69 ms |       **69 ms** |
| p95 latency     |   ~114 ms |     **99.5 ms** |
| Max latency     |   ~14.4 s |      **465 ms** |

The main improvement was reliability under concurrency: the service went from failing under load to completing the full test with **0% request failures**.

### Takeaway

The benchmark helped identify a real bottleneck before introducing more infrastructure. The connection pool fixed the concurrency issue and gave the service its first measured performance improvement.
