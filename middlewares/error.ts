import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/AppError";
import logger from "../lib/logger";

/**
 * Centralized error handler — the single place error responses are sent.
 * Must be registered LAST in app.ts (CLAUDE.md).
 *
 * Order matters:
 *   1. ZodError        -> 400 VALIDATION_ERROR (+ per-field messages)
 *   2. AppError        -> err.status / err.code (expected, operational)
 *   3. anything else   -> 500 INTERNAL_ERROR (logged; details never leaked)
 *
 * Response shape: { success: false, error: { message, code, fields? } }
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // 1. Validation errors from Zod (thrown by the validate middleware).
  if (err instanceof ZodError) {
    // flatten().fieldErrors can hold undefined; keep only real string arrays.
    const fields: Record<string, string[]> = {};
    for (const [key, messages] of Object.entries(err.flatten().fieldErrors)) {
      if (messages) fields[key] = messages;
    }

    res.status(400).json({
      success: false,
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        fields,
      },
    });
    return;
  }

  // 2. Expected/operational errors we raised on purpose. Safe to send.
  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  // 3. Anything else is unexpected: log the real error, return a generic 500.
  //    Never leak stack traces or internal messages to the client.
  logger.error("Unhandled error", { error: err });

  res.status(500).json({
    success: false,
    error: {
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    },
  });
};
