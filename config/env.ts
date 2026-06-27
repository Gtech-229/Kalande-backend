import "dotenv/config";
import { z } from "zod";

/**
 * Environment variable validation.
 *
 * We validate process.env ONCE here, at startup, using Zod.
 * If anything is missing or invalid, we print a clear list of every
 * problem and exit the process immediately (crash-fast) — the app
 * should never boot in a half-configured state.
 *
 * Import the typed `env` object anywhere instead of reading process.env.
 */

/**
 * Wrap an OPTIONAL env schema so a blank / whitespace-only value (e.g.
 * `SMTP_HOST=` in .env) is treated as "not set" (undefined) instead of failing
 * validation. This lets you disable an optional feature by leaving its line
 * empty, rather than having to delete the line (which previously crashed boot).
 */
const blankAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema
  );

const envSchema = z.object({
  // Runtime environment. Defaults to "development" if not set.
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // HTTP port. Env vars are strings, so coerce to a number.
  PORT: z.coerce.number().int().positive().default(3000),

  // Neon pooled connection string (used by the running app).
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Neon direct connection string (used only by Prisma migrations).
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),

  // Secret for signing access tokens.
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),

  // Secret for signing refresh tokens (must differ from JWT_SECRET).
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),

  // Access token lifetime (e.g. "15m"). String passed straight to jsonwebtoken.
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("15m"),

  // Refresh token lifetime (e.g. "30d").
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("30d"),

  // Allowed CORS origin(s). "*" or a comma-separated list.
  CORS_ORIGIN: z.string().min(1).default("*"),

  // Base URL of the frontend password-reset screen. The reset email links to
  // `${APP_RESET_URL}?token=...`. Defaults to a local dev value.
  APP_RESET_URL: z.string().url().default("http://localhost:8080/reset-password"),

  // --- Email (nodemailer SMTP) ---
  // Optional: if SMTP_HOST is unset OR blank, the app falls back to the log-only
  // email provider (nothing is actually sent), which is handy in development.
  SMTP_HOST: blankAsUndefined(z.string().min(1).optional()),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // true only for implicit TLS (port 465). Parsed from "true"/"false" — never
  // z.coerce.boolean(), which treats any non-empty string as true.
  SMTP_SECURE: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default("false"),
  SMTP_USER: blankAsUndefined(z.string().min(1).optional()),
  SMTP_PASS: blankAsUndefined(z.string().min(1).optional()),
  // The From header on outgoing emails (e.g. `ZASS <no-reply@zass.com>`).
  EMAIL_FROM: z.string().min(1).default("ZASS <no-reply@zass.local>"),

  // --- WhatsApp (whatsapp-web.js) ---
  // Off by default: when false the message provider uses the log-only stub and
  // no Chromium/WhatsApp session is launched (dev/test stay light). Parsed from
  // "true"/"false" — never z.coerce.boolean().
  WHATSAPP_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default("false"),
  // Folder where the WhatsApp session is persisted (LocalAuth). Survives
  // restarts so the QR only needs scanning once. Must be on durable disk.
  WHATSAPP_SESSION_PATH: z.string().min(1).default(".wwebjs_auth"),
  // Optional path to a system Chromium (e.g. /usr/bin/chromium). Leave unset or
  // blank to use the Chromium that Puppeteer downloads with whatsapp-web.js.
  PUPPETEER_EXECUTABLE_PATH: blankAsUndefined(z.string().min(1).optional()),

  // --- Admin bootstrap (used ONLY by prisma/seed.ts) ---
  // Optional so the server can boot without them; the seed checks they exist.
  ADMIN_NAME: z.string().min(1).default("Administrator"),
  ADMIN_EMAIL: blankAsUndefined(z.string().email().optional()),
  ADMIN_PASSWORD: blankAsUndefined(z.string().min(8).optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Build a readable, one-problem-per-line list of everything that failed.
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  // We cannot use the logger here: it may depend on validated env itself.
  console.error(
    `\n❌ Invalid environment variables:\n${issues}\n\n` +
      `Fix your .env file (see .env.example) and restart.\n`
  );

  process.exit(1);
}

/** Validated, typed environment. Import this everywhere instead of process.env. */
export const env = parsed.data;

/** Inferred type of the validated environment. */
export type Env = z.infer<typeof envSchema>;
