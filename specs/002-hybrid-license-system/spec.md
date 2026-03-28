# Feature Specification: Hybrid License System

**Feature Branch**: `002-hybrid-license-system`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "Hybrid License System with Ed25519 signing, feature gating by plan+addons, online heartbeat, and license generator CLI for on-premise deployments"

## Context

The platform currently uses HMAC-SHA256 for license signing, which requires a shared secret embedded in the application. If the application is decompiled, the secret is exposed and license keys can be forged. The license key is also stored only in environment variables, meaning it is lost on restart.

This feature replaces the existing license system with a production-grade Hybrid License model that:
- Uses Ed25519 asymmetric signing (private key stays with the vendor, public key embedded in the app)
- Supports offline-first validation with optional online heartbeat
- Enables feature gating through plan tiers + purchasable addons
- Provides a CLI tool for the vendor to generate license keys
- Persists license data in the database (survives restarts)

### Assumptions

- The platform vendor is the sole authority for generating license keys
- On-premise customers may operate in air-gapped networks with no internet access
- Each license key is tied to a single tenant (organization)
- Plan definitions (which features belong to which plan) are maintained in the application code, not in the license key
- The existing feature gate middleware will be adapted, not replaced
- License keys are delivered to customers via email, support portal, or sales team (out of scope)

## Clarifications

### Session 2026-03-26

- Q: Trial mode (no license activated) allows what? → A: Free plan equivalent — 3 cameras, HLS only, no API/embed/recording. Enough to evaluate before purchasing.

## User Scenarios & Testing

### User Story 1 — Vendor Generates License Key (Priority: P1)

A **vendor operator** uses a command-line tool to generate a signed license key for a customer. The tool accepts the customer name, plan tier, camera limits, optional addons, and expiry date. It outputs a license key string that the customer can paste into their on-premise console.

**Why this priority**: Without the ability to generate license keys, no on-premise customer can activate the platform. This is the foundation of the entire license system.

**Independent Test**: Can be tested by running the CLI tool and verifying the output key can be decoded and validated.

**Acceptance Scenarios**:

1. **Given** a vendor operator with access to the CLI tool, **When** they run the generate command with tenant name, plan "pro", 100 cameras, addon "recording", and expiry date 2027-03-26, **Then** a base64-encoded license key is output containing all specified parameters with a valid Ed25519 signature.
2. **Given** a generated license key, **When** any field in the key is modified after generation, **Then** signature verification fails and the key is rejected as invalid.
3. **Given** the CLI tool, **When** an invalid plan name or negative camera count is provided, **Then** the tool shows a clear validation error and does not generate a key.
4. **Given** the CLI tool, **When** no expiry date is provided, **Then** the tool defaults to 1 year from the current date.

---

### User Story 2 — Customer Activates License (Priority: P1)

An **on-premise customer admin** receives a license key from the vendor. They log into the platform console, navigate to Settings > License, and paste the key. The system validates the key and unlocks the appropriate features and limits based on the encoded plan and addons.

**Why this priority**: License activation is the first action any on-premise customer takes. Without it, the platform runs in limited/trial mode.

**Independent Test**: Can be tested by activating a known-good license key and verifying features are unlocked.

**Acceptance Scenarios**:

1. **Given** a freshly deployed on-premise instance with no license, **When** the admin pastes a valid Pro license key with 100 cameras, **Then** the system shows "License Active", the camera limit changes to 100, and Pro features are enabled.
2. **Given** an active license, **When** the admin views the License page, **Then** they see: plan name, camera limit, enabled features, expiry date, and days remaining.
3. **Given** an expired license key (beyond grace period), **When** the admin tries to activate it, **Then** the system rejects it with "License has expired. Contact your vendor for renewal."
4. **Given** a license key with a tampered signature, **When** activation is attempted, **Then** the system rejects it with "Invalid license key."

---

### User Story 3 — Feature Gating by Plan and Addons (Priority: P1)

The platform **enforces feature availability** based on the active license's plan tier and purchased addons. When a user tries to access a feature not included in their plan, the system shows a clear message indicating the feature requires an upgrade. Hard limits (cameras, users, projects) are enforced at the middleware level.

**Why this priority**: Feature gating is the commercial backbone of the platform. Without it, all features are accessible regardless of what the customer paid for.

**Independent Test**: Can be tested by activating a Starter license and verifying that Pro-only features are blocked while Starter features work.

**Acceptance Scenarios**:

1. **Given** a Starter plan license (no recording addon), **When** the admin tries to enable recording on a camera, **Then** the system shows "Recording is not available on your plan."
2. **Given** a Pro plan license with 100 camera limit, **When** the admin has 100 cameras and tries to add camera #101, **Then** the system shows "Camera limit reached (100). Contact your vendor to increase your limit."
3. **Given** a Pro plan license with the "recording" addon, **When** the admin enables recording, **Then** recording works normally.
4. **Given** a Free plan (no API access), **When** an external system calls the API with an API key, **Then** the request is rejected with "API access is not available on your plan."
5. **Given** any plan, **When** a user navigates to a feature page not included in their plan, **Then** the page shows the feature description with a prompt to contact the vendor for upgrade.

---

### User Story 4 — License Expiry and Grace Period (Priority: P2)

When a license approaches expiry, the platform shows **progressive warnings**. After expiry, a 30-day grace period allows continued operation with warning banners. After the grace period, the platform enters read-only mode where existing streams continue but no new cameras or sessions can be created.

**Why this priority**: Graceful degradation prevents customer data loss and service disruption while motivating renewal.

**Independent Test**: Can be tested by activating a license with a near-expiry date and observing warning behavior.

**Acceptance Scenarios**:

1. **Given** a license expiring in 14 days, **When** any admin logs in, **Then** a warning banner shows "Your license expires in 14 days. Contact your vendor to renew."
2. **Given** a license that expired 5 days ago (within grace period), **When** the admin uses the platform, **Then** all features still work but a persistent warning shows "Your license expired 5 days ago. Renew within 25 days to avoid service interruption."
3. **Given** a license that expired 31 days ago (beyond grace period), **When** the admin tries to add a camera or create a playback session, **Then** the action is blocked with "License expired. Renew your license to continue using this feature."
4. **Given** an expired license beyond grace period, **When** existing camera streams are running, **Then** they continue to operate (streams are not forcibly stopped).

---

### User Story 5 — License Persistence Across Restarts (Priority: P1)

The activated license key is **stored in the database**, not just in environment variables. When the platform restarts, it reads the license from the database and resumes normal operation without requiring re-activation.

**Why this priority**: Losing the license on every restart is a critical usability issue for production deployments.

**Independent Test**: Can be tested by activating a license, restarting the application, and verifying features remain unlocked.

**Acceptance Scenarios**:

1. **Given** an activated license stored in the database, **When** the platform restarts, **Then** the license is automatically loaded and all features remain available.
2. **Given** a license key provided via both environment variable and database, **When** the platform starts, **Then** the database value takes precedence.
3. **Given** a platform with no license in DB and no env var, **When** the platform starts in on-prem mode, **Then** it runs in trial mode (Free plan: 3 cameras, HLS only, no API/embed/recording) showing "No license activated. Running in trial mode."

---

### User Story 6 — License Key Upgrade/Renewal (Priority: P2)

A customer can **replace their existing license key** with a new one (e.g., after purchasing more cameras or renewing). The new key takes effect immediately without restarting the platform.

**Why this priority**: Customers need seamless upgrades without downtime.

**Independent Test**: Can be tested by activating a Starter key, then replacing it with a Pro key and verifying limits change.

**Acceptance Scenarios**:

1. **Given** an active Starter license (50 cameras), **When** the admin activates a new Pro license (500 cameras), **Then** the camera limit immediately changes to 500 and Pro features are enabled.
2. **Given** an active license, **When** the admin activates a renewal key (same plan, new expiry), **Then** the expiry date updates and no features are disrupted.
3. **Given** a license upgrade, **When** the new key has fewer features than the old one, **Then** the system applies the new key's features (downgrade is allowed).

---

### User Story 7 — Online Heartbeat Validation (Priority: P3)

For on-premise deployments with internet access, the platform **periodically contacts the vendor's license server** to validate the license status. This enables license revocation and provides deployment telemetry. The heartbeat is optional — the platform operates fully offline if the server is unreachable.

**Why this priority**: Nice-to-have for license management at scale, but the platform must work without it for air-gapped deployments.

**Independent Test**: Can be tested by configuring a heartbeat URL and observing periodic validation calls.

**Acceptance Scenarios**:

1. **Given** an on-premise deployment with heartbeat URL configured, **When** the platform starts, **Then** it sends a heartbeat containing: license ID, camera count, platform version.
2. **Given** a successful heartbeat, **When** the vendor has not revoked the license, **Then** the platform caches the "valid" response for 72 hours.
3. **Given** a heartbeat that fails (server unreachable), **When** the cached validation is less than 72 hours old, **Then** the platform continues operating normally.
4. **Given** a heartbeat where the vendor responds with "revoked", **When** the platform processes the response, **Then** it enters the same state as an expired license.
5. **Given** no heartbeat URL configured, **When** the platform operates, **Then** no heartbeat is sent and the license is validated purely offline.

---

### Edge Cases

- What happens when the system clock is set far in the future to bypass expiry? → License expiry is compared against system time; clock manipulation is not prevented (standard industry practice).
- What happens when two instances share the same license key? → Allowed for single-tenant deployments. Multi-instance detection is out of scope.
- What happens when the license key string is truncated or corrupted? → Base64 decode fails, system reports "Invalid license key format."
- What happens when the Ed25519 public key embedded in the app is modified? → Signature verification fails for all keys; the admin must reinstall the application.
- What happens when a license is activated during active streaming? → Streams continue uninterrupted; new limits apply to subsequent actions.

## Requirements

### Functional Requirements

- **FR-001**: System MUST validate license keys using Ed25519 asymmetric signature verification (public key embedded in application, private key held by vendor only).
- **FR-002**: System MUST decode license keys from base64-encoded strings containing: license ID, tenant name, plan name, hard limits, addons list, issued date, expiry date, and Ed25519 signature.
- **FR-003**: System MUST persist activated license keys in the database and load them automatically on startup.
- **FR-004**: System MUST enforce hard limits (cameras, users, projects, sites, API keys, viewer hours, retention days) based on the active license.
- **FR-005**: System MUST resolve effective features by combining the plan's base feature set with any addons specified in the license key.
- **FR-006**: System MUST provide a CLI tool that generates signed license keys given: tenant name, plan, limits, addons, and expiry date.
- **FR-007**: System MUST show a warning banner when a license is within 30 days of expiry.
- **FR-008**: System MUST allow a 30-day grace period after license expiry during which all features continue to work with a persistent warning.
- **FR-009**: System MUST enter read-only mode after the grace period expires, while allowing existing streams to continue.
- **FR-010**: System MUST allow license key replacement without requiring application restart.
- **FR-011**: System MUST support an optional online heartbeat that sends license ID, camera count, and platform version to a configurable vendor URL.
- **FR-012**: System MUST cache heartbeat responses for 72 hours, allowing continued operation if the server is unreachable.
- **FR-013**: System MUST support license revocation via heartbeat response.
- **FR-014**: System MUST display the current license status (plan, limits, features, expiry, days remaining) on the License settings page.
- **FR-015**: System MUST show a clear upgrade prompt when a user attempts to use a feature not included in their plan.
- **FR-016**: The CLI tool MUST validate inputs before generating a key.

### Key Entities

- **License Key**: A base64-encoded, Ed25519-signed payload containing plan, limits, addons, and expiry. Stored in the database after activation.
- **Plan Tier**: A named tier (free, starter, pro, enterprise) that maps to a base set of features and default limits. Definitions maintained in application code.
- **Addon**: A purchasable feature that extends a plan's base features. Encoded in the license key.
- **Feature Gate**: A runtime check that determines whether a user action is allowed based on the effective feature set and hard limits.
- **Heartbeat**: An optional periodic message from the deployment to the vendor's license server.

## Success Criteria

### Measurable Outcomes

- **SC-001**: License activation completes within 2 seconds of pasting the key.
- **SC-002**: The CLI tool generates a valid license key in under 1 second.
- **SC-003**: Feature access checks add less than 10 milliseconds to any user action.
- **SC-004**: The platform resumes full operation within 5 seconds of restart with a previously activated license.
- **SC-005**: 100% of gated features are correctly blocked when not in plan and accessible when in plan.
- **SC-006**: A modified license key is rejected 100% of the time by signature verification.
- **SC-007**: The platform operates normally for at least 72 hours without internet after a successful heartbeat.
- **SC-008**: License expiry warnings appear at least 30 days before expiration on every page for admin users.
