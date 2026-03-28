<!--
  === Sync Impact Report ===
  Version change: N/A (initial) → 1.0.0
  Modified principles: N/A (initial ratification)
  Added sections:
    - Core Principles (6 principles)
    - Architecture Non-Negotiables
    - Default OSS Stack
    - UI/Frontend Standards
    - Versioning Standards
    - Monorepo Standard
    - Governance
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed (Constitution Check is generic)
    - .specify/templates/spec-template.md ✅ no changes needed (generic structure)
    - .specify/templates/tasks-template.md ✅ no changes needed (generic structure)
  Follow-up TODOs: None
-->

# B2B CCTV Streaming Platform Constitution

## Mission

Build a secure, scalable, open-source-first CCTV streaming platform
(SaaS + On-Prem HCI) that ingests RTSP from IP cameras/NVRs and
delivers web/mobile playback to B2B developers via API + embeddable
links, with optional public map viewing.

## Core Principles

### I. Open-Source First

Every component choice MUST prefer an OSS alternative. Any proprietary
dependency MUST be explicitly justified in writing (in the relevant
spec or plan document) with:
- Why no OSS option meets the requirement
- Migration path back to OSS if one matures
- License compatibility with the project

### II. Strict Separation — Control Plane vs Data Plane

The system MUST maintain strict separation between:
- **Control Plane**: Auth, backoffice UI, tenant/project management,
  API gateway, billing, audit logs
- **Data Plane**: RTSP ingest, stream packaging, HLS/LL-HLS delivery,
  optional WebRTC relay, recording storage

No Data Plane component may depend on Control Plane availability for
active stream delivery. Control Plane failures MUST NOT interrupt
in-progress playback sessions.

### III. Default Protocol — HLS/LL-HLS First

HLS/LL-HLS is the default delivery protocol for all public and
embedded playback. WebRTC is an optional low-latency tier that MUST
NOT be required for baseline functionality. All features MUST work
with HLS before WebRTC support is considered.

### IV. Security by Default

- Playback sessions MUST use short-lived signed tokens
  (TTL 60–300 seconds, refreshable).
- Domain/origin allowlist MUST be supported for embedded players.
- All administrative and security-relevant actions MUST produce
  audit log entries.
- Rate limiting and replay protection MUST be enforced on session
  token endpoints.

### V. Minimize Transcoding

The default ingest-to-delivery path MUST use repackage/copy (no
transcoding). Transcoding is selective and opt-in only, triggered by
explicit tenant or project configuration. This is critical for
On-Prem HCI targets (500–1000 cameras) where CPU budget is limited.

### VI. Operations-Ready

Every deployed service MUST expose:
- Prometheus-compatible metrics endpoint
- Structured logging (JSON) to stdout/stderr
- Health check endpoint

Alerting rules, runbooks, capacity planning guidance, and load test
scripts MUST be maintained alongside the services they monitor.

## Architecture Non-Negotiables

- **Multi-tenant model**: tenant → projects → sites → cameras.
  All queries MUST be scoped to tenant. Cross-tenant data leakage
  is a critical-severity defect.
- **Signed playback sessions**:
  - TTL 60–300 seconds, refreshable
  - Optional embed policy: domain/origin allowlist
  - Rate limiting + replay protection
- **On-Prem HCI target**: 500–1000 cameras using repackage/copy
  as the baseline. Transcoding budgets are separate and opt-in.
- **RTSP resilience**: RTSP is unreliable by nature. Every camera
  connection MUST implement auto-reconnect with exponential backoff
  and expose a per-camera health state machine
  (e.g., connecting → online → degraded → offline → reconnecting).
- **No unlimited public playback** without usage controls.
  Viewer-hours, egress caps, or CDN-based throttling MUST be
  enforced before any stream is publicly accessible.

## Default OSS Stack

| Concern | Default Choice | Notes |
|---------|---------------|-------|
| Auth/IAM | Keycloak | OIDC/OAuth2 provider |
| Database | PostgreSQL | Latest stable major |
| Cache/Session/Rate Limit | Redis | |
| Streaming Ingest | MediaMTX or SRS | Evaluate per feature |
| Packaging | FFmpeg or GStreamer | Copy/repackage preferred |
| Delivery | HLS/LL-HLS via origin + cache | WebRTC optional (coturn for TURN) |
| Observability | Prometheus + Grafana + Loki | Alertmanager for alerts |

Deviations from this stack MUST be justified per Principle I.

## UI/Frontend Standards

- All UI primitives and patterns MUST use **shadcn/ui** components
  (forms, tables, dialogs, sheets, cards, tabs, toasts, dropdowns).
- Theme preset MUST be: `--preset b2BWMmrjc`.
- The B2B admin UI MUST be dense but readable, responsive,
  keyboard-friendly, and follow consistent patterns across pages.

## Versioning Standards

- Use latest **STABLE LTS** releases only (no beta/rc/canary):
  - Node.js: latest LTS
  - Next.js: latest stable (non-canary)
  - PostgreSQL: latest stable major
- All versions MUST be pinned via lockfiles and container tags.
- All runtime versions MUST be documented in `/docs/versions.md`.

## Monorepo Standard

- Use **pnpm workspaces + Turborepo**.
- Repository structure MUST include:

```text
/apps/console-web          # B2B admin console (Next.js)
/apps/api-control          # Control Plane API
/apps/data-plane-worker    # Data Plane worker services
/packages/ui               # Shared UI components (shadcn/ui)
/packages/config           # Shared configuration
/packages/sdk              # Client SDK
/packages/types            # Shared TypeScript types
```

## Governance

1. **Constitution supremacy**: This constitution supersedes all other
   project practices. When a spec, plan, or PR conflicts with a
   principle defined here, the constitution wins.
2. **Amendment procedure**: Any change to this constitution MUST be
   proposed as a dedicated PR with:
   - Clear description of what changes and why
   - Impact assessment on existing specs and plans
   - Version bump following semver (MAJOR for principle
     removal/redefinition, MINOR for additions, PATCH for
     clarifications)
3. **Compliance review**: Every spec and plan MUST include a
   "Constitution Check" section verifying alignment with all
   principles before implementation begins.
4. **Versioning policy**: This constitution follows semantic
   versioning. The version line below MUST be updated with every
   amendment.

**Version**: 1.0.0 | **Ratified**: 2026-03-22 | **Last Amended**: 2026-03-22
