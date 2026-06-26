// Relative import (not the @/ alias) on purpose: ambient global augmentation
// files don't reliably honor tsconfig path aliases.
import type { JwtPayload } from "./lib/jwt";

/**
 * Express.Request augmentation.
 *
 * Adds `req.user`, populated by the auth middleware after a valid access token
 * is verified. Optional because unprotected routes never set it.
 *
 * `interface` is required here: declaration merging (extending Express.Request)
 * only works with interfaces (CLAUDE.md allows interface for extension cases).
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
