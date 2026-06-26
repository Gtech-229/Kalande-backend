import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { verifyAccessToken } from "../lib/jwt";
import { AppError } from "../lib/AppError";

/**
 * authenticate — protects a route with a Bearer access token.
 *
 * Expects header:  Authorization: Bearer <accessToken>
 *
 * Missing/!Bearer header -> AppError(401, "MISSING_TOKEN")
 * Invalid/expired token  -> AppError(401, "INVALID_TOKEN") (thrown by verifyAccessToken)
 * Success                -> attaches the decoded payload to req.user
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError(401, "MISSING_TOKEN", "Authorization header is missing");
    }

    // "Bearer <token>" -> "<token>"
    const token = header.slice("Bearer ".length).trim();

    if (!token) {
      console.log("No token header")
      throw new AppError(401, "MISSING_TOKEN", "Authorization header is missing");
    }

    // Throws AppError(401, "INVALID_TOKEN") if the token is invalid or expired.
    req.user = verifyAccessToken(token);

    next();
  }
);
