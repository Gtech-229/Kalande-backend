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

/**
 * How long a SET (first-time password definition) token stays valid. Longer
 * than a reset token because a newly-created user may take a while to act on
 * their welcome email. Seven days.
 */
export const SET_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How long a PIN-login challenge (nonce) stays valid. Short on purpose: the
 * device requests it and signs it back within seconds. Single-use. Two minutes.
 */
export const PIN_CHALLENGE_TTL_MS = 2 * 60 * 1000;
