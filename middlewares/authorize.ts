import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Role } from "@prisma/client";
import { AppError } from "../lib/AppError";

/**
 * authorize — restricts a route to one or more roles (RBAC).
 *
 * Must run AFTER the authenticate middleware, which sets req.user (with the role
 * read from the access token). Reads no DB: the role lives in the JWT payload.
 *
 * No req.user (authenticate missing) -> AppError(401, "MISSING_TOKEN")
 * Role not in the allowed list       -> AppError(403, "FORBIDDEN")
 * Success                            -> calls next()
 *
 * Usage:
 *   router.post("/", authenticate, authorize(Role.ADMIN), validate(schema), handler);
 *   router.get("/", authenticate, authorize(Role.ADMIN, Role.SUPERVISOR), handler);
 */
export function authorize(...allowedRoles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Defensive: authorize without authenticate first is a wiring mistake.
    if (!req.user) {
      throw new AppError(401, "MISSING_TOKEN", "Authentication required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to perform this action"
      );
    }

    next();
  };
}
