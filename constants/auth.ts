/**
 * Auth-related constants.
 * Keep magic numbers out of the business logic (CLAUDE.md).
 */

/**
 * bcrypt cost factor (salt rounds). Higher = slower hashing = harder to brute
 * force. 12 is a good default for a backend in 2025.
 */
export const SALT_ROUNDS = 12;

/**
 * How long a password reset token stays valid. Short on purpose: the token is
 * single-use and only needs to live long enough for the user to open the email
 * and pick a new password. One hour.
 */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
