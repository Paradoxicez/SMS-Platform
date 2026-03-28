# sms-app Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-26

## Active Technologies
- PostgreSQL 17.x (primary), Redis 7.x (sessions/cache/rate-limit) (001-cctv-streaming-platform)
- TypeScript 5.x on Node.js 22.x LTS + Hono 4.x (API), Next.js 15.x (Console), Drizzle ORM 0.38.x, @noble/ed25519 (signing) (002-hybrid-license-system)
- PostgreSQL 17.x (license persistence), Redis 7.x (cached license status) (002-hybrid-license-system)

- TypeScript 5.x on Node.js 22.x LTS + Hono 4.x (API), Next.js 15.x (Console), Drizzle ORM 0.38.x (DB), Zod 3.x (validation), shadcn/ui (UI), MediaMTX 1.x (streaming), hls.js 1.x (player), Leaflet 1.9.x (map) (001-cctv-streaming-platform)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x on Node.js 22.x LTS: Follow standard conventions

## Recent Changes
- 002-hybrid-license-system: Added TypeScript 5.x on Node.js 22.x LTS + Hono 4.x (API), Next.js 15.x (Console), Drizzle ORM 0.38.x, @noble/ed25519 (signing)
- 001-cctv-streaming-platform: Added TypeScript 5.x on Node.js 22.x LTS + Hono 4.x (API), Next.js 15.x (Console), Drizzle ORM 0.38.x (DB), Zod 3.x (validation), shadcn/ui (UI), MediaMTX 1.x (streaming), hls.js 1.x (player), Leaflet 1.9.x (map)

- 001-cctv-streaming-platform: Added TypeScript 5.x on Node.js 22.x LTS + Hono 4.x (API), Next.js 15.x (Console), Drizzle ORM 0.38.x (DB), Zod 3.x (validation), shadcn/ui (UI), MediaMTX 1.x (streaming), hls.js 1.x (player), Leaflet 1.9.x (map)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
