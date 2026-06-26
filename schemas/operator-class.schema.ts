import { z } from "zod";

/**
 * Operator-class request schemas. One file per domain (CLAUDE.md).
 * These drive the endpoints that manage which classes an OPERATOR may enroll
 * students into (the operator_classes pivot).
 *
 * Each schema is exported together with its inferred input type — the single
 * source of truth for the endpoints' input shape.
 */

/** Route param for /operators/:operatorId/classes. */
export const operatorParamSchema = z.object({
  operatorId: z.coerce
    .number()
    .int()
    .positive("A valid operator id is required"),
});
export type OperatorParam = z.infer<typeof operatorParamSchema>;

/** POST body: the class to authorize the operator for. */
export const assignClassSchema = z.object({
  classId: z.coerce.number().int().positive("A valid class id is required"),
});
export type AssignClassInput = z.infer<typeof assignClassSchema>;

/** Route params for DELETE /operators/:operatorId/classes/:classId. */
export const operatorClassParamSchema = z.object({
  operatorId: z.coerce
    .number()
    .int()
    .positive("A valid operator id is required"),
  classId: z.coerce.number().int().positive("A valid class id is required"),
});
export type OperatorClassParam = z.infer<typeof operatorClassParamSchema>;
