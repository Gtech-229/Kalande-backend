import jwt, { type SignOptions } from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env } from "../config/env";
import { AppError } from "../lib/AppError";

/**
 * The data we embed inside every JWT.
 * `role` is included so the authorize() middleware can gate routes without an
 * extra DB lookup on every request.
 */
export type JwtPayload = {
  userId: number;
  email: string;
  role: Role;
};

// jsonwebtoken types `expiresIn` as a narrow template-literal type, but our
// value comes from env as a plain string. This single narrow cast keeps the
// call sites readable without resorting to `any`.
const accessOptions: SignOptions = {
  expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
};
const refreshOptions: SignOptions = {
  expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
};

/** Create a short-lived access token. */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, accessOptions);
}

/** Create a long-lived refresh token. */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, refreshOptions);
}

/**
 * Verify an access token.
 * Throws AppError(401) if it is invalid or expired — never lets the raw
 * JsonWebTokenError bubble up.
 */
export function verifyAccessToken(token: string): JwtPayload {
  return verify(token, env.JWT_SECRET);
}

/**
 * Verify a refresh token.
 * Throws AppError(401) if it is invalid or expired.
 */
export function verifyRefreshToken(token: string): JwtPayload {
  return verify(token, env.JWT_REFRESH_SECRET);
}

/**
 * Read a token's expiry as a Date (from its `exp` claim).
 * Used to set Token.expiresAt when we persist a refresh token.
 * Throws AppError(401) if the token has no usable expiry.
 */
export function getTokenExpiry(token: string): Date {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string" || typeof decoded.exp !== "number") {
    throw new AppError(401, "INVALID_TOKEN", "Token is missing an expiry");
  }
  return new Date(decoded.exp * 1000);
}

/**
 * Shared verify helper. Validates the signature/expiry, then returns only the
 * fields we care about as a typed JwtPayload.
 */
function verify(token: string, secret: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return { userId: decoded.userId, email: decoded.email, role: decoded.role };
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Invalid or expired token");
  }
}
