import { Prisma, Role, PasswordTokenType } from "@prisma/client";
import { db } from "../config/database";
import { AppError } from "../lib/AppError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getTokenExpiry,
  type JwtPayload,
} from "../lib/jwt";
import { hashPassword, comparePassword } from "../utils/password";
import { hashToken, generateToken } from "../utils/token";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./email.service";
import { RESET_TOKEN_TTL_MS, SET_TOKEN_TTL_MS } from "../constants/auth";
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
  LogoutInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  PasswordModeQuery,
} from "../schemas/auth.schema";

/**
 * Auth business logic. No Express types here (CLAUDE.md) — controllers adapt
 * HTTP to/from these plain typed objects.
 */

/** The user fields we are allowed to expose to the client (never the password). */
type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
};

/** Returned by register/login. */
type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

/** Returned by refresh (rotation issues a fresh pair). */
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

/** A Prisma client OR a transaction client — both can run our writes. */
type DbClient = Prisma.TransactionClient | typeof db;

/** Strip a User row down to the safe public shape. */
export function toPublicUser(user: {
  id: number;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Sign a refresh token, store ONLY its SHA-256 hash, and return the raw token.
 * The raw token goes to the client; the DB keeps the hash so it can be revoked.
 */
async function issueRefreshToken(
  client: DbClient,
  payload: JwtPayload
): Promise<string> {
  const refreshToken = signRefreshToken(payload);

  await client.token.create({
    data: {
      token: hashToken(refreshToken),
      userId: payload.userId,
      expiresAt: getTokenExpiry(refreshToken),
    },
  });

  return refreshToken;
}

/**
 * Issue a fresh access + refresh token pair for a user and persist the refresh
 * token. Shared by password login and PIN login so both produce identical
 * sessions.
 */
export async function issueTokensForUser(user: {
  id: number;
  email: string;
  role: Role;
}): Promise<TokenPair> {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = await issueRefreshToken(db, payload);
  return { accessToken, refreshToken };
}

/**
 * Register the single Admin account.
 * - Fails if an Admin already exists (only one allowed).
 * - Fails if the email is already taken.
 * - Auto-logs-in: returns the user plus a fresh token pair.
 */
export async function register(input: RegisterInput): Promise<AuthResult> {
  const adminExists = await db.user.findFirst({
    where: { role: Role.ADMIN, deletedAt: null },
  });
  if (adminExists) {
    throw new AppError(409, "ADMIN_EXISTS", "An admin account already exists");
  }

  const emailTaken = await db.user.findUnique({
    where: { email: input.email },
  });
  if (emailTaken) {
    throw new AppError(409, "EMAIL_TAKEN", "Email already registered");
  }

  const password = await hashPassword(input.password);

  // Two tables (user + token) -> single transaction (CLAUDE.md).
  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        password,
        role: Role.ADMIN,
      },
    });

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = await issueRefreshToken(tx, payload);

    return { user, accessToken, refreshToken };
  });

  return {
    user: toPublicUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  };
}

/**
 * Log in with email + password.
 * Returns the user plus a fresh token pair. A failed match is always reported
 * as the same generic error (never reveal whether the email exists).
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await db.user.findUnique({ where: { email: input.email } });

  // Same error for "no such user" and "wrong password" on purpose.
  if (!user || user.deletedAt) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const passwordOk = await comparePassword(input.password, user.password);
  if (!passwordOk) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = await issueRefreshToken(db, payload);

  return { user: toPublicUser(user), accessToken, refreshToken };
}

/**
 * Exchange a valid refresh token for a NEW token pair (rotation).
 * The old refresh token is deleted so it can never be used again.
 */
export async function refresh(input: RefreshInput): Promise<TokenPair> {
  // 1. Verify signature/expiry (throws AppError(401) if invalid/expired).
  const payload = verifyRefreshToken(input.refreshToken);

  // 2. Confirm the token still exists in the DB .
  const stored = await db.token.findUnique({
    where: { token: hashToken(input.refreshToken) },
  });
  if (!stored) {
    throw new AppError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token is no longer valid"
    );
  }

  // 3. Rotate: delete the old token and issue a brand-new pair.
  return db.$transaction(async (tx) => {
    await tx.token.delete({ where: { id: stored.id } });

    const newPayload: JwtPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    const accessToken = signAccessToken(newPayload);
    const refreshToken = await issueRefreshToken(tx, newPayload);

    return { accessToken, refreshToken };
  });
}

/**
 * Log out by revoking a refresh token (delete its row).
 * Idempotent: silently succeeds even if the token is already gone, and does not
 * require the token to still be valid — a user must always be able to log out.
 */
export async function logout(input: LogoutInput): Promise<void> {
  await db.token.deleteMany({
    where: { token: hashToken(input.refreshToken) },
  });
}

/**
 * Issue a single-use password token (SET or RESET) for a user. Stores ONLY the
 * SHA-256 hash, picks the TTL by type, and returns the raw token to be emailed.
 * One active token per user: earlier ones are dropped first.
 * Shared by the forgot-password flow and account creation (the welcome link).
 */
export async function issuePasswordToken(
  userId: number,
  type: PasswordTokenType
): Promise<string> {
  const rawToken = generateToken();
  const ttl =
    type === PasswordTokenType.SET ? SET_TOKEN_TTL_MS : RESET_TOKEN_TTL_MS;

  await db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId } }),
    db.passwordResetToken.create({
      data: {
        token: hashToken(rawToken),
        userId,
        type,
        expiresAt: new Date(Date.now() + ttl),
      },
    }),
  ]);

  return rawToken;
}

/**
 * Start the forgot/set-password flow.
 * `mode` = "reset" (forgot-password) or "set" (re-send a first-time definition
 * link). Issues the matching token and emails the matching message.
 *
 * Always resolves the same way whether or not the email exists — we never reveal
 * which addresses have an account (no email enumeration).
 */
export async function forgotPassword(
  input: ForgotPasswordInput,
  mode: PasswordModeQuery["mode"]
): Promise<void> {
  const user = await db.user.findFirst({
    where: { email: input.email, deletedAt: null },
  });

  // Unknown email -> do nothing, but still return success to the caller.
  if (!user) {
    return;
  }

  const type =
    mode === "set" ? PasswordTokenType.SET : PasswordTokenType.RESET;
  const rawToken = await issuePasswordToken(user.id, type);

  // Failure-safe emails: a send error is recorded as a FAILED EmailLog, so the
  // endpoint still responds the same (no enumeration).
  if (type === PasswordTokenType.SET) {
    await sendWelcomeEmail({
      userId: user.id,
      to: user.email,
      name: user.name,
      token: rawToken,
    });
  } else {
    await sendPasswordResetEmail({
      userId: user.id,
      to: user.email,
      name: user.name,
      token: rawToken,
    });
  }
}

/**
 * Finish the forgot-password flow with the emailed token.
 * Validates the token (exists, unused, not expired), sets the new password, marks
 * the token used, and revokes all refresh tokens so old sessions cannot continue.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const stored = await db.passwordResetToken.findUnique({
    where: { token: hashToken(input.token) },
  });

  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw new AppError(
      400,
      "INVALID_RESET_TOKEN",
      "This password reset link is invalid or has expired"
    );
  }

  const password = await hashPassword(input.newPassword);

  // Three tables (user + reset token + refresh tokens) -> single transaction.
  await db.$transaction([
    db.user.update({
      where: { id: stored.userId },
      data: { password, mustChangePassword: false },
    }),
    db.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    }),
    db.token.deleteMany({ where: { userId: stored.userId } }),
  ]);
}

/**
 * Change the password of the currently authenticated user.
 * Requires the current password to match. Revokes all refresh tokens afterwards
 * so other sessions must log in again with the new password.
 */
export async function changePassword(
  userId: number,
  input: ChangePasswordInput
): Promise<void> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    // The token was valid but the account is gone — treat as unauthorized.
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
  }

  const currentOk = await comparePassword(input.currentPassword, user.password);
  if (!currentOk) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Current password is incorrect"
    );
  }

  const password = await hashPassword(input.newPassword);

  // Two tables (user + refresh tokens) -> single transaction.
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { password, mustChangePassword: false },
    }),
    db.token.deleteMany({ where: { userId: user.id } }),
  ]);
}
