# Implementation Plan: Hybrid License System

**Branch**: `002-hybrid-license-system` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-hybrid-license-system/spec.md`

## Summary

Replace the existing HMAC-SHA256 license system with a production-grade Ed25519-based Hybrid License model. The system supports offline-first validation, feature gating by plan tier + addons, database persistence, progressive expiry/grace period handling, optional online heartbeat for revocation, and a CLI tool for the vendor to generate license keys.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22.x LTS
**Primary Dependencies**: Hono 4.x (API), Next.js 15.x (Console), Drizzle ORM 0.38.x, @noble/ed25519 (signing)
**Storage**: PostgreSQL 17.x (license persistence), Redis 7.x (cached license status)
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Linux server (Docker), macOS (dev)
**Project Type**: Monorepo (pnpm + Turborepo) — web-service + CLI tool
**Performance Goals**: License validation < 10ms, activation < 2s, CLI generation < 1s
**Constraints**: Must work fully offline (air-gapped), Ed25519 public key embedded in app binary
**Scale/Scope**: Single-tenant on-prem (1 license per deployment), 4 plan tiers, ~15 gatable features

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Open-Source First | PASS | @noble/ed25519 is OSS (MIT). No proprietary dependencies. |
| II. Strict Separation (CP/DP) | PASS | License is Control Plane only. Data Plane streams continue even if license expires (per spec FR-009). |
| III. Default Protocol — HLS First | N/A | License system does not affect protocol selection. |
| IV. Security by Default | PASS | Ed25519 asymmetric signing prevents key forgery. Tampered keys rejected by signature verification. |
| V. Minimize Transcoding | N/A | License system does not affect transcoding. |
| VI. Operations-Ready | PASS | License status exposed via `/license/status` API. Structured logging for activation/expiry events. |
| Multi-tenant model | PASS | License is tenant-scoped. On-prem = single tenant. |
| shadcn/ui | PASS | License UI uses existing shadcn/ui components. |
| Monorepo Standard | PASS | CLI tool lives in `scripts/` at repo root. No new `/apps/` or `/packages/` needed. |

No violations. No complexity tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/002-hybrid-license-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
# Files modified (existing)
apps/api-control/src/services/license.ts          # Replace HMAC → Ed25519, add DB persistence
apps/api-control/src/services/feature-gate.ts      # Adapt to plan+addon resolution
apps/api-control/src/middleware/license.ts          # Grace period + read-only mode
apps/api-control/src/routes/license.ts             # Activate, status, heartbeat endpoints
apps/api-control/src/db/schema/                    # License table migration
apps/console-web/app/(auth)/settings/license/      # Enhanced License UI
apps/console-web/components/license-banner.tsx     # Expiry warning banner

# Files added (new)
scripts/generate-license.ts                        # CLI tool for vendor
apps/api-control/src/services/license-heartbeat.ts # Optional heartbeat service
apps/api-control/src/lib/plan-definitions.ts       # Plan tier → features mapping
```

**Structure Decision**: No new apps or packages needed. The CLI tool is a standalone script at repo root (`scripts/`). All license logic stays in `api-control` (Control Plane). Frontend changes are limited to the existing License settings page and a new warning banner component.

## Phases

### Phase 1: Core License Engine (P1 — US1, US2, US5)

**Goal**: Ed25519 signing, CLI generator, activation, DB persistence

1. Generate Ed25519 key pair (private key for vendor, public key for app)
2. Create plan definitions file (plan → features + default limits mapping)
3. Create CLI tool (`scripts/generate-license.ts`) that signs license payloads
4. Replace `license.ts` service: HMAC → Ed25519, add DB read/write
5. Add `licenses` table to DB schema (key, decoded data, activated_at)
6. Update License API routes (activate persists to DB, status reads from DB)
7. Update License settings page to show plan, features, limits, expiry

**Checkpoint**: Generate key via CLI → activate in UI → restart → still active

### Phase 2: Feature Gating (P1 — US3)

**Goal**: Enforce plan features and hard limits across the platform

1. Create plan-definitions mapping (4 tiers × features + limits)
2. Refactor `feature-gate.ts` to resolve features from license (plan + addons)
3. Add `requireFeature("feature_name")` middleware
4. Apply feature gates to all gatable routes (recording, webhooks, embed, API, etc.)
5. Add frontend upgrade prompts (show feature description + contact vendor)
6. Hide/disable UI elements for features not in active plan

**Checkpoint**: Starter license → recording blocked → upgrade to Pro → recording works

### Phase 3: Expiry & Grace Period (P2 — US4, US6)

**Goal**: Progressive warnings, grace period, read-only mode, seamless upgrades

1. Add expiry check middleware (30-day warning, grace period, read-only)
2. Create license warning banner component (persistent, dismissible per-session)
3. Implement read-only mode (block new cameras/sessions, allow existing streams)
4. Support license key replacement without restart (hot-swap in DB + memory)
5. Add license audit events (activated, expired, renewed, downgraded)

**Checkpoint**: Activate near-expiry key → see warning → let it expire → grace → read-only

### Phase 4: Heartbeat (P3 — US7)

**Goal**: Optional online validation + revocation support

1. Create heartbeat service (periodic POST to vendor URL)
2. Send: license ID, camera count, platform version
3. Handle responses: valid (cache 72h), revoked (trigger expiry flow)
4. Graceful fallback: server unreachable → use cached status
5. Config: `LICENSE_HEARTBEAT_URL` env var (empty = disabled)

**Checkpoint**: Configure heartbeat URL → see periodic calls → simulate revocation → platform enters grace

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Signing algorithm | Ed25519 via @noble/ed25519 | OSS, fast, small signatures, asymmetric (safe to embed public key) |
| Key storage | Private key: vendor-only file. Public key: embedded in app code | Standard practice for license systems |
| Plan definitions | In application code (not DB) | Prevents customers from modifying plan features via DB |
| License persistence | PostgreSQL `licenses` table | Survives restarts, queryable, auditable |
| CLI tool location | `scripts/generate-license.ts` (tsx runner) | No new package needed, runs with existing toolchain |
| Feature resolution | `planFeatures[tier] + addons` | Simple, deterministic, easy to test |
| Heartbeat interval | Every 24 hours | Low bandwidth, sufficient for revocation detection |
| Cache duration | 72 hours | Generous offline tolerance for unstable networks |
| Trial mode | Free plan equivalent (3 cameras, HLS only) | Per clarification session 2026-03-26 |
