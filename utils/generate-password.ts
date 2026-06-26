import { randomInt } from "node:crypto";

/**
 * Generate a strong random password (pure, no DB).
 *
 * Used for admin-created accounts: the client never sends a password — the
 * backend generates one, stores only its bcrypt hash, and emails the plaintext
 * to the user in their welcome message.
 *
 * The result is guaranteed to satisfy passwordSchema (auth.schema.ts) — at least
 * one uppercase letter, one digit, and one special character — so the user can
 * actually log in with it (loginSchema validates against the same rules).
 *
 * Character sets omit easily-confused glyphs (0/O, 1/l/I) so the password stays
 * readable when typed from the welcome email.
 */
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%^&*";
const ALL = UPPERCASE + LOWERCASE + DIGITS + SPECIAL;

/** Pick one random character from a set, using a crypto-safe random index. */
function pick(set: string): string {
  return set[randomInt(set.length)];
}

/** Fisher-Yates shuffle so the guaranteed characters are not always up front. */
function shuffle(characters: string[]): string[] {
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters;
}

export function generatePassword(length = 16): string {
  // Start with one character from each required category (satisfies the rules).
  const required = [pick(UPPERCASE), pick(DIGITS), pick(SPECIAL)];

  // Fill the rest from the full alphabet.
  const rest: string[] = [];
  for (let i = required.length; i < length; i++) {
    rest.push(pick(ALL));
  }

  return shuffle([...required, ...rest]).join("");
}
