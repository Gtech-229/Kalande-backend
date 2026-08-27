import { z } from "zod";

/**
 * Class request schemas. One file per domain (CLAUDE.md).
 * Each schema is exported together with its inferred input type — this is the
 * single source of truth for the class endpoints' input shape.
 */

/**
 * POST /classes — create a class and assign an EXISTING supervisor to it.
 * The client picks a SUPERVISOR account that is not yet assigned to a class and
 * sends only its id; the service validates the account (exists, right role, not
 * already assigned). Users are created independently, with no class.
 */
export const createClassSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  supervisorId: z.coerce
    .number()
    .int()
    .positive("A valid supervisor id is required"),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

/**
 * PATCH /classes/:id — rename a class and/or reassign its supervisor.
 * Both fields optional, but at least one must be provided. A new supervisor must
 * be an existing, unassigned SUPERVISOR (same rules as create); the old
 * supervisor is freed automatically.
 */
export const updateClassSchema = z
  .object({
    name: z.string().min(1, "Class name is required").optional(),
    supervisorId: z.coerce
      .number()
      .int()
      .positive("A valid supervisor id is required")
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.supervisorId !== undefined, {
    message: "At least one field must be provided",
  });
export type UpdateClassInput = z.infer<typeof updateClassSchema>;

/**
 * DELETE /classes/:id — route param. Express gives strings, so coerce to number
 * (CLAUDE.md).
 */
export const classIdParamSchema = z.object({
  id: z.coerce.number().int().positive("A valid class id is required"),
});
export type ClassIdParam = z.infer<typeof classIdParamSchema>;
