#!/usr/bin/env npx tsx
/**
 * License Key Generator CLI
 *
 * Usage:
 *   pnpm license:generate --tenant "Company ABC" --plan pro --cameras 100 --addons recording --expires 2027-03-26
 */

import { Command } from "commander";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";
import { ed25519 } from "@noble/curves/ed25519.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LicensePayload {
  id: string;
  tenant: string;
  plan: string;
  limits: {
    cameras: number;
    projects: number;
    users: number;
    sites: number;
    api_keys: number;
    viewer_hours: number;
    retention_days: number;
  };
  addons: string[];
  issuedAt: string;
  expiresAt: string;
}

// ─── Plan defaults ──────────────────────────────────────────────────────────

const PLAN_DEFAULTS: Record<string, LicensePayload["limits"]> = {
  free: { cameras: 3, projects: 1, users: 2, sites: 1, api_keys: 0, viewer_hours: 100, retention_days: 0 },
  starter: { cameras: 50, projects: 3, users: 5, sites: 5, api_keys: 2, viewer_hours: 1000, retention_days: 7 },
  pro: { cameras: 500, projects: 10, users: 20, sites: 30, api_keys: 10, viewer_hours: 10000, retention_days: 30 },
  enterprise: { cameras: 999999, projects: 999999, users: 999999, sites: 999999, api_keys: 999999, viewer_hours: 999999, retention_days: 90 },
};

const VALID_PLANS = Object.keys(PLAN_DEFAULTS);

const VALID_ADDONS = [
  "recording", "ai", "sso", "multi_engine", "white_label",
  "webrtc", "embed", "api_access", "csv_import", "webhooks",
  "forwarding", "custom_profiles", "map_public", "audit_log",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base64urlEncode(data: Uint8Array): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateLicenseId(): string {
  const year = new Date().getFullYear();
  const seq = randomBytes(3).toString("hex").toUpperCase();
  return `LIC-${year}-${seq}`;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("generate-license")
  .description("Generate a signed Ed25519 license key for on-premise deployments")
  .requiredOption("--tenant <name>", "Customer/organization name")
  .requiredOption("--plan <tier>", `Plan tier (${VALID_PLANS.join("/")})`)
  .option("--cameras <n>", "Max cameras (default: plan default)", parseInt)
  .option("--projects <n>", "Max projects (default: plan default)", parseInt)
  .option("--users <n>", "Max users (default: plan default)", parseInt)
  .option("--sites <n>", "Max sites (default: plan default)", parseInt)
  .option("--api-keys <n>", "Max API keys (default: plan default)", parseInt)
  .option("--viewer-hours <n>", "Viewer hours quota (default: plan default)", parseInt)
  .option("--retention-days <n>", "Recording retention days (default: plan default)", parseInt)
  .option("--addons <list>", "Comma-separated addon names", "")
  .option("--expires <date>", "Expiry date (YYYY-MM-DD, default: +1 year)")
  .option("--private-key <path>", "Path to Ed25519 private key", "keys/license.private.key")
  .action((opts) => {
    // Validate plan
    if (!VALID_PLANS.includes(opts.plan)) {
      console.error(`Error: Invalid plan "${opts.plan}". Must be one of: ${VALID_PLANS.join(", ")}`);
      process.exit(1);
    }

    // Validate addons
    const addons = opts.addons
      ? opts.addons.split(",").map((a: string) => a.trim()).filter(Boolean)
      : [];

    for (const addon of addons) {
      if (!VALID_ADDONS.includes(addon)) {
        console.error(`Error: Invalid addon "${addon}". Valid addons: ${VALID_ADDONS.join(", ")}`);
        process.exit(1);
      }
    }

    // Validate/default expiry
    let expiresAt: string;
    if (opts.expires) {
      const d = new Date(opts.expires);
      if (isNaN(d.getTime())) {
        console.error(`Error: Invalid date "${opts.expires}". Use YYYY-MM-DD format.`);
        process.exit(1);
      }
      if (d <= new Date()) {
        console.error(`Error: Expiry date must be in the future.`);
        process.exit(1);
      }
      expiresAt = d.toISOString().split("T")[0]!;
    } else {
      const oneYear = new Date();
      oneYear.setFullYear(oneYear.getFullYear() + 1);
      expiresAt = oneYear.toISOString().split("T")[0]!;
    }

    // Validate cameras
    if (opts.cameras !== undefined && opts.cameras <= 0) {
      console.error("Error: Camera count must be a positive number.");
      process.exit(1);
    }

    // Load private key
    const keyPath = path.resolve(opts.privateKey);
    let privateKey: Uint8Array;
    try {
      const hex = fs.readFileSync(keyPath, "utf-8").trim();
      privateKey = Buffer.from(hex, "hex");
    } catch {
      console.error(`Error: Cannot read private key at: ${keyPath}`);
      console.error("Run 'pnpm license:keygen' to generate a key pair first.");
      process.exit(1);
    }

    // Build payload
    const defaults = PLAN_DEFAULTS[opts.plan]!;
    const payload: LicensePayload = {
      id: generateLicenseId(),
      tenant: opts.tenant,
      plan: opts.plan,
      limits: {
        cameras: opts.cameras ?? defaults.cameras,
        projects: opts.projects ?? defaults.projects,
        users: opts.users ?? defaults.users,
        sites: opts.sites ?? defaults.sites,
        api_keys: opts.apiKeys ?? defaults.api_keys,
        viewer_hours: opts.viewerHours ?? defaults.viewer_hours,
        retention_days: opts.retentionDays ?? defaults.retention_days,
      },
      addons,
      issuedAt: new Date().toISOString().split("T")[0]!,
      expiresAt,
    };

    // Sign
    const payloadJson = JSON.stringify(payload);
    const payloadBytes = new TextEncoder().encode(payloadJson);
    const signature = ed25519.sign(payloadBytes, privateKey);

    const payloadB64 = base64urlEncode(payloadBytes);
    const signatureB64 = base64urlEncode(signature);
    const licenseKey = `${payloadB64}.${signatureB64}`;

    // Output
    console.log("");
    console.log("✓ License generated");
    console.log("");
    console.log(`  ID:        ${payload.id}`);
    console.log(`  Tenant:    ${payload.tenant}`);
    console.log(`  Plan:      ${payload.plan}`);
    console.log(`  Cameras:   ${payload.limits.cameras}`);
    console.log(`  Projects:  ${payload.limits.projects}`);
    console.log(`  Users:     ${payload.limits.users}`);
    if (addons.length > 0) {
      console.log(`  Addons:    ${addons.join(", ")}`);
    }
    console.log(`  Issued:    ${payload.issuedAt}`);
    console.log(`  Expires:   ${payload.expiresAt}`);
    console.log("");
    console.log("  License Key:");
    console.log(`  ${licenseKey}`);
    console.log("");
  });

program.parse();
