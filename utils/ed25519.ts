import {
  createPublicKey,
  verify,
  randomBytes,
  type KeyObject,
} from "node:crypto";

/**
 * Ed25519 helpers for device/PIN authentication (pure, no DB, no Express).
 *
 * The device holds the private key (unlocked by the local PIN) and signs a
 * server challenge; the backend stores only the PUBLIC key and verifies the
 * signature. Nothing secret is ever sent to the server.
 *
 * Wire format (must match the Flutter client):
 *   - public key: raw 32-byte Ed25519 key, base64
 *   - signature:  raw 64-byte Ed25519 signature, base64
 *   - message:    the challenge STRING, signed as its UTF-8 bytes
 */

// DER SubjectPublicKeyInfo prefix for an Ed25519 key. Node needs a full SPKI
// key object, but the client sends only the raw 32 bytes — we prepend this.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Build a Node public-key object from a raw 32-byte Ed25519 key (base64). */
function toPublicKey(publicKeyBase64: string): KeyObject {
  const raw = Buffer.from(publicKeyBase64, "base64");
  if (raw.length !== 32) {
    throw new Error("Ed25519 public key must be 32 bytes");
  }
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

/** Whether a base64 string decodes to exactly `bytes` bytes. */
export function isBase64OfLength(value: string, bytes: number): boolean {
  try {
    return Buffer.from(value, "base64").length === bytes;
  } catch {
    return false;
  }
}

/** A random login challenge (nonce), base64. The device signs its UTF-8 bytes. */
export function generateChallenge(): string {
  return randomBytes(32).toString("base64");
}

/**
 * Verify an Ed25519 signature over `message` (a UTF-8 string) using a raw
 * base64 public key and a raw base64 signature. Returns false on any error
 * (malformed key/signature) instead of throwing.
 */
export function verifyEd25519Signature(
  publicKeyBase64: string,
  message: string,
  signatureBase64: string
): boolean {
  try {
    const key = toPublicKey(publicKeyBase64);
    const signature = Buffer.from(signatureBase64, "base64");
    return verify(null, Buffer.from(message, "utf8"), key, signature);
  } catch {
    return false;
  }
}
