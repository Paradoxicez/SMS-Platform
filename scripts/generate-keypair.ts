#!/usr/bin/env npx tsx
/**
 * Ed25519 Key Pair Generator
 *
 * Usage:
 *   pnpm license:keygen
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

const keysDir = path.resolve("keys");

// Check if keys already exist
const privPath = path.join(keysDir, "license.private.key");
const pubPath = path.join(keysDir, "license.public.key");

if (fs.existsSync(privPath) || fs.existsSync(pubPath)) {
  console.error("Error: Key files already exist in keys/ directory.");
  console.error("Delete them first if you want to regenerate.");
  console.error(`  ${privPath}`);
  console.error(`  ${pubPath}`);
  process.exit(1);
}

// Generate
fs.mkdirSync(keysDir, { recursive: true });

const privateKey = randomBytes(32);
const publicKey = ed25519.getPublicKey(privateKey);

fs.writeFileSync(privPath, Buffer.from(privateKey).toString("hex"));
fs.writeFileSync(pubPath, Buffer.from(publicKey).toString("hex"));

console.log("");
console.log("✓ Ed25519 key pair generated");
console.log("");
console.log(`  Private key: ${privPath}`);
console.log(`  Public key:  ${pubPath}`);
console.log("");
console.log("  IMPORTANT: Keep the private key secret!");
console.log("  The public key will be embedded in the application.");
console.log("");
