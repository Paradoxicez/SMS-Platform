# Tasks: Hybrid License System

**Input**: Design documents from `/specs/002-hybrid-license-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Ed25519 key pair generation and shared infrastructure

- [x] T001 Install `@noble/ed25519` dependency in `apps/api-control/package.json`
- [x] T002 [P] Generate Ed25519 key pair and store private key at `keys/license.private.key`, public key at `keys/license.public.key`
- [x] T003 [P] Add `keys/*.key` to `.gitignore` (private key must never be committed)
- [x] T004 [P] Create plan definitions constant in `apps/api-control/src/lib/plan-definitions.ts` with 4 tiers (free/starter/pro/enterprise), feature lists, and default limits per plan

**Checkpoint**: Key pair exists, plan definitions importable

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and core license validation engine

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create `licenses` table schema (id, tenant_id, license_key, license_id, plan, limits, addons, issued_at, expires_at, activated_at, is_active) in `apps/api-control/src/db/schema/licenses.ts`
- [x] T006 Export `licenses` from `apps/api-control/src/db/schema/index.ts`
- [x] T007 Run DB migration: `ALTER TABLE` to add `licenses` table in PostgreSQL
- [x] T008 [P] Create Ed25519 sign/verify utility functions in `apps/api-control/src/lib/ed25519.ts` (load public key from file or embedded constant, verify signature)
- [x] T009 [P] Create license key encode/decode functions in `apps/api-control/src/lib/license-codec.ts` (base64url payload + signature format, decode + verify in one step)

**Checkpoint**: DB table exists, can sign and verify license key payloads programmatically

---

## Phase 3: User Story 1 — Vendor Generates License Key (Priority: P1) 🎯 MVP

**Goal**: CLI tool that generates Ed25519-signed license keys

**Independent Test**: Run CLI → get license key → decode it → verify signature passes

- [x] T010 [US1] Create CLI script `scripts/generate-license.ts` with commander.js arg parsing (--tenant, --plan, --cameras, --projects, --users, --addons, --expires, --private-key)
- [x] T011 [US1] Implement key generation logic in CLI: validate inputs → build payload JSON → sign with Ed25519 private key → output base64url encoded key
- [x] T012 [US1] Add `license:generate` script to root `package.json`
- [x] T013 [P] [US1] Create key pair generation CLI command `scripts/generate-keypair.ts` and add `license:keygen` script to root `package.json`
- [x] T014 [US1] Add input validation: reject invalid plan names, negative camera counts, past expiry dates; default expiry to +1 year if not specified

**Checkpoint**: `pnpm license:generate --tenant "Test" --plan pro --cameras 100` outputs a valid license key

---

## Phase 4: User Story 2 — Customer Activates License (Priority: P1)

**Goal**: Paste license key in console → validate → persist to DB → unlock features

**Independent Test**: Generate key → paste in License page → see "Active" status → restart app → still active

- [x] T015 [US2] Rewrite `apps/api-control/src/services/license.ts`: replace HMAC with Ed25519 verification, add DB read/write (insert license record, deactivate previous), load from DB on startup
- [x] T016 [US2] Update `apps/api-control/src/routes/license.ts`: POST /license/activate persists to DB and returns decoded plan/limits/features/expiry; GET /license/status reads from DB with computed days_remaining and effective features (plan + addons)
- [x] T017 [US2] Add feature resolution logic in license service: merge plan base features (from plan-definitions) with addons from license key to produce effective feature list
- [x] T018 [US2] Update `apps/console-web/app/(auth)/settings/license/page.tsx`: show plan name, camera limit, enabled features list, addons, expiry date, days remaining after activation
- [x] T019 [US2] Add license activation audit event logging in `apps/api-control/src/services/license.ts`

**Checkpoint**: Generate key → activate in UI → restart api-control → GET /license/status returns same active license

---

## Phase 5: User Story 5 — License Persistence Across Restarts (Priority: P1)

**Goal**: License survives application restarts by reading from DB

**Independent Test**: Activate license → restart Docker containers → verify features still unlocked

- [x] T020 [US5] Add startup license loader in `apps/api-control/src/index.ts`: on boot, read active license from `licenses` table, cache in memory, skip if `DEPLOYMENT_MODE !== 'onprem'`
- [x] T021 [US5] Handle precedence: DB license > env var LICENSE_KEY > no license (trial mode)
- [x] T022 [US5] Set trial mode defaults when no license is active: apply Free plan (3 cameras, HLS only, no API/embed/recording) per clarification

**Checkpoint**: Activate license → `docker compose restart api-control` → GET /license/status still shows active

---

## Phase 6: User Story 3 — Feature Gating by Plan and Addons (Priority: P1)

**Goal**: Enforce feature availability and hard limits based on active license

**Independent Test**: Activate Starter license → try recording → blocked → activate Pro + recording addon → recording works

- [x] T023 [US3] Refactor `apps/api-control/src/services/feature-gate.ts`: read effective features from license service instead of subscription_plans table; export `getEffectiveFeatures(tenantId)` and `getEffectiveLimits(tenantId)`
- [x] T024 [US3] Create `requireFeature(featureName)` middleware in `apps/api-control/src/middleware/feature-gate.ts` that checks if feature is in effective feature list, returns 403 with upgrade message if not
- [x] T025 [US3] Apply `requireFeature` middleware to all gatable routes: recording (`requireFeature("recording")`), webhooks, embed/playback, API access, CSV import, forwarding, AI integrations in their respective route files
- [x] T026 [US3] Update `requireCameraSlot` middleware in `apps/api-control/src/middleware/feature-gate.ts` to read camera limit from license instead of subscription plan
- [x] T027 [P] [US3] Create upgrade prompt component in `apps/console-web/components/upgrade-prompt.tsx`: shows feature name, description, and "Contact your vendor" message
- [x] T028 [US3] Add feature visibility checks in frontend: hide/disable menu items and buttons for features not in active plan using license status API in `apps/console-web/components/app-sidebar.tsx` and relevant page components

**Checkpoint**: Activate Starter key → recording menu shows upgrade prompt → webhooks blocked at API → activate Pro key → everything works

---

## Phase 7: User Story 4 — License Expiry and Grace Period (Priority: P2)

**Goal**: Progressive warnings → grace period → read-only mode

**Independent Test**: Activate near-expiry license → see warning → let it expire → verify grace → verify read-only after 30 days

- [x] T029 [US4] Add expiry checking in license middleware `apps/api-control/src/middleware/license.ts`: compute status (active/expiring/grace_period/read_only), block mutating actions in read_only mode, allow existing streams
- [x] T030 [US4] Create license warning banner component in `apps/console-web/components/license-banner.tsx`: shows days until expiry (expiring) or days since expiry (grace), persistent but dismissible per session
- [x] T031 [US4] Add banner to auth layout `apps/console-web/app/(auth)/layout.tsx`: fetch license status on mount, show banner if status is expiring or grace_period
- [x] T032 [US4] Update read-only mode behavior: block POST /cameras, POST /playback/sessions, POST /api-clients in license middleware; return 403 with "License expired" message

**Checkpoint**: Activate license expiring in 1 day → warning shows → change system clock → grace period banner → 31 days later → camera add blocked

---

## Phase 8: User Story 6 — License Key Upgrade/Renewal (Priority: P2)

**Goal**: Replace license key without restart, immediate effect

**Independent Test**: Activate Starter → verify limits → activate Pro → verify limits increased without restart

- [x] T033 [US6] Add hot-swap logic in `apps/api-control/src/services/license.ts`: when new key activated, deactivate old record in DB, update in-memory cache, emit event
- [x] T034 [US6] Update License settings page `apps/console-web/app/(auth)/settings/license/page.tsx`: allow re-activation (paste new key over existing), show confirmation dialog before replacing
- [x] T035 [US6] Add license change audit events: `license.upgraded`, `license.renewed`, `license.downgraded` in `apps/api-control/src/services/license.ts`

**Checkpoint**: Activate Starter (50 cameras) → activate Pro (500 cameras) → camera limit immediately shows 500

---

## Phase 9: User Story 7 — Online Heartbeat (Priority: P3)

**Goal**: Optional periodic validation with revocation support

**Independent Test**: Set LICENSE_HEARTBEAT_URL → observe periodic POST → simulate revoked response → platform enters grace

- [x] T036 [US7] Create heartbeat service in `apps/api-control/src/services/license-heartbeat.ts`: periodic POST (every 24h) sending license_id, camera_count, platform_version to configurable URL
- [x] T037 [US7] Handle heartbeat responses: "valid" → cache for 72h in Redis, "revoked" → trigger expiry flow in license service
- [x] T038 [US7] Add graceful fallback: if heartbeat URL not configured → skip entirely; if server unreachable → use cached status; if cache expired (>72h) → log warning but don't block
- [x] T039 [US7] Start/stop heartbeat service in `apps/api-control/src/index.ts` lifecycle (only if LICENSE_HEARTBEAT_URL env is set)

**Checkpoint**: Set heartbeat URL → see POST in server logs → remove URL → no more heartbeat → platform continues normally

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, documentation, edge case hardening

- [x] T040 [P] Remove old HMAC license code from `apps/api-control/src/services/license.ts` (ensure no references remain)
- [x] T041 [P] Update `LICENSE-SYSTEM.md` at project root with final implementation details (actual CLI usage, key format examples)
- [x] T042 [P] Add `.env.example` entries for LICENSE_KEY, LICENSE_HEARTBEAT_URL, DEPLOYMENT_MODE in `apps/api-control/.env`
- [x] T043 Update License settings page to show license history (previous keys with activated/deactivated dates) from `licenses` table
- [x] T044 Add structured logging for all license events (activation, expiry warning, grace period entry, read-only trigger, heartbeat success/failure)
- [x] T045 Run quickstart.md validation: generate key → activate → verify features → restart → verify persistence

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — CLI tool, can start first
- **US2 (Phase 4)**: Depends on Phase 2 + Phase 3 (needs keys to activate)
- **US5 (Phase 5)**: Depends on Phase 4 (needs activation to test persistence)
- **US3 (Phase 6)**: Depends on Phase 4 (needs active license to test gating)
- **US4 (Phase 7)**: Depends on Phase 4 (needs active license to test expiry)
- **US6 (Phase 8)**: Depends on Phase 4 (needs active license to test upgrade)
- **US7 (Phase 9)**: Depends on Phase 4 (needs active license for heartbeat)
- **Polish (Phase 10)**: Depends on all desired stories complete

### User Story Dependencies

- **US1** (generate key): Independent — only needs foundational
- **US2** (activate): Needs US1 output (a generated key)
- **US5** (persistence): Needs US2 (an activated license to restart with)
- **US3** (feature gating): Needs US2 (an active license to gate against)
- **US4** (expiry/grace): Needs US2 (an active license to expire)
- **US6** (upgrade): Needs US2 (an existing license to replace)
- **US7** (heartbeat): Needs US2 (an active license to heartbeat with)

### Parallel Opportunities

After US2 is complete, US3, US4, US6, and US7 can all proceed in parallel:

```
Phase 1 → Phase 2 → US1 → US2 → ┬─ US3 (feature gating)
                                  ├─ US4 (expiry/grace)
                                  ├─ US5 (persistence)
                                  ├─ US6 (upgrade)
                                  └─ US7 (heartbeat)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US5)

1. Complete Phase 1: Setup (key pair, plan definitions)
2. Complete Phase 2: Foundational (DB schema, Ed25519 utils)
3. Complete Phase 3: US1 — CLI generates keys
4. Complete Phase 4: US2 — Console activates keys
5. Complete Phase 5: US5 — License persists across restarts
6. **STOP and VALIDATE**: Generate key → activate → restart → still active

### Incremental Delivery

7. Add US3 — Feature gating enforced → Deploy
8. Add US4 — Expiry warnings + grace period → Deploy
9. Add US6 — Upgrade/renewal hot-swap → Deploy
10. Add US7 — Heartbeat (optional) → Deploy

---

## Notes

- [P] tasks = different files, no dependencies
- [USn] label maps task to specific user story
- Each user story is independently testable after US2 (activation) is done
- Commit after each task or logical group
- Old HMAC code removed only in Polish phase (backward compatibility during migration)
- Private key (`keys/license.private.key`) must NEVER be committed to git
