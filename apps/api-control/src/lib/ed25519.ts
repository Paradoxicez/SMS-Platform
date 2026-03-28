/**
 * Ed25519 signing and verification utilities for license system.
 * Uses @noble/curves (pure JS, no native deps).
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import fs from "node:fs";
import path from "node:path";

// Public key embedded in app — loaded from file or env
let cachedPublicKey: Uint8Array | null = null;

/**
 * Load the Ed25519 public key for verification.
 * Priority: env var > file > error
 */
export function getPublicKey(): Uint8Array {
  if (cachedPublicKey) return cachedPublicKey;

  // Try env var first
  const envKey = process.env["LICENSE_PUBLIC_KEY"];
  if (envKey) {
    cachedPublicKey = Buffer.from(envKey, "hex");
    return cachedPublicKey;
  }

  // Try file
  const keyPath = path.resolve(process.cwd(), "../../keys/license.public.key");
  try {
    const hex = fs.readFileSync(keyPath, "utf-8").trim();
    cachedPublicKey = Buffer.from(hex, "hex");
    return cachedPublicKey;
  } catch {
    // Fallback: try from project root
    const altPath = path.resolve(process.cwd(), "keys/license.public.key");
    try {
      const hex = fs.readFileSync(altPath, "utf-8").trim();
      cachedPublicKey = Buffer.from(hex, "hex");
      return cachedPublicKey;
    } catch {
      throw new Error(
        "License public key not found. Set LICENSE_PUBLIC_KEY env or place keys/license.public.key",
      );
    }
  }
}

/**
 * Load the Ed25519 private key for signing (CLI tool only).
 */
export function getPrivateKey(keyPath?: string): Uint8Array {
  const resolvedPath =
    keyPath ??
    process.env["LICENSE_PRIVATE_KEY_PATH"] ??
    path.resolve(process.cwd(), "keys/license.private.key");

  try {
    const hex = fs.readFileSync(resolvedPath, "utf-8").trim();
    return Buffer.from(hex, "hex");
  } catch {
    throw new Error(`License private key not found at: ${resolvedPath}`);
  }
}

/**
 * Sign a message with Ed25519 private key.
 */
export function sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey);
}

/**
 * Verify an Ed25519 signature.
 */
export function verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey?: Uint8Array,
): boolean {
  const pubKey = publicKey ?? getPublicKey();
  try {
    return ed25519.verify(signature, message, pubKey);
  } catch {
    return false;
  }
}

/**
 * Get the public key from a private key (for key pair generation).
 */
export function getPublicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
  return ed25519.getPublicKey(privateKey);
}
