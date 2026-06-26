import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a high-entropy random token (64 hex chars / 32 bytes).
 * Used for password reset tokens: the raw value is emailed to the user, and
 * only its hash (see hashToken) is stored.
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a token for storage with SHA-256.
 *
 * We never store refresh tokens in plaintext. SHA-256 (not bcrypt) is the right
 * choice here because:
 *   - the token is already high-entropy, so a slow salted hash adds nothing;
 *   - it is deterministic, so we can look a row up by its hash (unique index);
 *   - bcrypt would truncate the token at 72 bytes.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
