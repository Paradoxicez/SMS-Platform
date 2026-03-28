import { describe, it, expect } from "vitest";
import { sign, verify, getPublicKeyFromPrivate } from "../ed25519";
import { ed25519 } from "@noble/curves/ed25519.js";

describe("ed25519", () => {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = getPublicKeyFromPrivate(privateKey);

  it("should derive public key from private key", () => {
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey.length).toBe(32);
  });

  it("should sign and verify a message", () => {
    const message = new TextEncoder().encode("test license payload");
    const signature = sign(message, privateKey);

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBe(64);

    const isValid = verify(signature, message, publicKey);
    expect(isValid).toBe(true);
  });

  it("should reject a tampered message", () => {
    const message = new TextEncoder().encode("original payload");
    const tampered = new TextEncoder().encode("tampered payload");
    const signature = sign(message, privateKey);

    const isValid = verify(signature, tampered, publicKey);
    expect(isValid).toBe(false);
  });

  it("should reject a tampered signature", () => {
    const message = new TextEncoder().encode("test payload");
    const signature = sign(message, privateKey);

    // Flip a byte in the signature
    const badSig = new Uint8Array(signature);
    badSig[0] = badSig[0]! ^ 0xff;

    const isValid = verify(badSig, message, publicKey);
    expect(isValid).toBe(false);
  });

  it("should reject verification with wrong public key", () => {
    const otherPrivate = ed25519.utils.randomSecretKey();
    const otherPublic = getPublicKeyFromPrivate(otherPrivate);

    const message = new TextEncoder().encode("test payload");
    const signature = sign(message, privateKey);

    const isValid = verify(signature, message, otherPublic);
    expect(isValid).toBe(false);
  });
});
