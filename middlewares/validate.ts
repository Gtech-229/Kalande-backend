import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodSchema } from "zod";

/** Which part of the request to validate. */
type RequestPart = "body" | "query" | "params";

/**
 * validate — runs a Zod schema against one part of the request.
 *
 * On failure: forwards the ZodError to next() so the central error middleware
 *             builds the response. We never send a response here.
 * On success: replaces req[part] with the PARSED data, so downstream handlers
 *             receive typed and coerced values (e.g. "5" -> 5).
 *
 * Usage:
 *   router.post("/", validate(createUserSchema), createUser);
 *   router.get("/:id", validate(idParamSchema, "params"), getUser);
 */
export function validate(
  schema: ZodSchema,
  part: RequestPart = "body"
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      // Hand the ZodError to the error middleware — do not respond here.
      next(result.error);
      return;
    }

    // Replace the raw input with the parsed/coerced data.
    // Cast is needed because Express types req.query/req.params as read-only.
    (req as Record<RequestPart, unknown>)[part] = result.data;
    next();
  };
}
