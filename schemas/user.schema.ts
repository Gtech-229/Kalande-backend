import { z } from "zod";
import { Role } from "@prisma/client";

/**
 * User request schemas. One file per domain (CLAUDE.md).
 * Each schema is exported together with its inferred input type — this is the
 * single source of truth for the user endpoints' input shape.
 */

/**
 * POST /users — Admin creates a SUPERVISOR or OPERATOR account.
 * No password field: the client never sends one. The backend generates a random
 * password, stores only its hash, and emails the plaintext to the user.
 * ADMIN is never accepted: the single admin is created via the seed/register
 * flow only (APP_CONTEXT.md). New users start with no class (classId = null);
 * they are linked to a class later (e.g. when a class is created).
 */
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("A valid email is required"),
  role: z.nativeEnum(Role).refine((role) => role !== Role.ADMIN, {
    message: "Role must be SUPERVISOR or OPERATOR",
  }),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * GET /users?role=SUPERVISOR&assigned=false — optional list filters.
 * - role:     fetch users of one role (e.g. supervisors).
 * - assigned: filter by whether the user has a home class (classId). Used to
 *             list "available" supervisors (assigned=false) when creating a
 *             class — a supervisor can run at most one class.
 * Query values are strings, so `assigned` is parsed from "true"/"false".
 * Omit a filter to skip it.
 */
/** Route param for /users/:id endpoints. Express gives strings, so coerce. */
export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive("A valid user id is required"),
});
export type UserIdParam = z.infer<typeof userIdParamSchema>;

export const listUsersQuerySchema = z.object({
  role: z.nativeEnum(Role).optional(),
  assigned: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
