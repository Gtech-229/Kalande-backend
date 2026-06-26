import bcrypt from "bcrypt";
import { SALT_ROUNDS } from "../constants/auth";

/**
 * Password hashing helpers (pure, no DB) — wrap bcrypt so the rest of the app
 * never calls bcrypt directly and never sees the cost factor.
 */

/** Hash a plaintext password for storage. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Check a plaintext password against a stored bcrypt hash. */
export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
