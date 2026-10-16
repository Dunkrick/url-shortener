# Nip — URL Shortener

A URL shortener I built to learn backend engineering and gradually add
things like caching, rate limiting, load testing, and cloud deployment.

Live demo: https://drabnip.vercel.app

## What it does

- Creates short URLs
- Redirects short codes to their original URLs
- Uses PostgreSQL to store URL mappings
- Uses Redis to cache redirects
- Rate-limits URL creation
- Tracks the total number of redirects
- Runs locally using Docker Compose

## Tech stack

- Go — API and redirect service
- PostgreSQL — persistent URL mappings
- Redis — redirect cache, rate limiting, and redirect counter
- React, TypeScript, Vite — frontend
- Docker Compose — local development
- Google Cloud Run — Go API
- Cloud SQL — managed PostgreSQL
- Google Cloud Memorystore — managed Redis
- Vercel — frontend hosting and request rewrites
- k6 — load testing

## How it works

The frontend is hosted on Vercel. The Go API runs on Cloud Run.

Vercel forwards API requests and short-code requests to the Go service.
The Go service uses PostgreSQL as the source of truth and Redis to avoid
repeated database reads for popular URLs.

```text
Browser
   |
   v
Vercel frontend
   |
   | API requests / short-code visits
   v
Go API on Cloud Run
   |             |
   v             v
PostgreSQL      Redis
```
