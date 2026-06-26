import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * asyncHandler — wraps an async Express route handler.
 *
 * Why this exists:
 * Express (v4) does NOT catch errors thrown inside an async function. If a
 * Promise rejects, the error is lost and the request hangs forever instead of
 * reaching the error middleware. Wrapping a handler here forwards any rejection
 * to next(), so our central error middleware can respond.
 *
 * This lets controllers stay clean: they just `throw` (or `await` something that
 * throws) and never need their own try/catch (CLAUDE.md).
 *
 * Usage:
 *   router.get("/", asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
