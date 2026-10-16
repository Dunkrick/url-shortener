# System Design

These are the main decisions behind Nip and why I made them.

## 1. Requirements

### Functional

- Create a short URL.
- Redirect a short code to the original URL.
- Return the total redirect count.

### Non-functional

- Keep redirects fast.
- Avoid short-code collisions.
- Support multiple application instances.
- Keep the architecture simple enough to measure and improve.

The system is designed around a read-heavy workload. A 100:1
redirect-to-create ratio is an example assumption, not a measured
production traffic ratio.

## 2. Architecture

```text
Browser
   |
   v
Vercel
   |
   | /api/* and /:shortCode
   v
Go API on Cloud Run
   |                  |
   v                  v
PostgreSQL           Redis
Cloud SQL            Memorystore
```
