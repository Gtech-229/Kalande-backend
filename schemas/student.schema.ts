import { z } from "zod";
import { StudentStatus } from "@prisma/client";

/**
 * Student request schemas. One file per domain (CLAUDE.md).
 * Each schema is exported together with its inferred input type — this is the
 * single source of truth for the student endpoints' input shape.
 */

/** Parent WhatsApp number — international format, e.g. +2250700000000. */
const whatsappSchema = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "WhatsApp must be in international format, e.g. +2250700000000"
  );

/**
 * POST /students — enroll a new student.
 * `status` is NOT accepted on create: a new student is always ACTIVE (the
 * service/DB default). It is only changed later via update.
 */
export const createStudentSchema = z.object({
  classId: z.coerce.number().int().positive("A valid class id is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  birthDate:  z.coerce.date(),
  parentName: z.string().min(1, "Parent name is required"),
  parentWhatsapp: whatsappSchema,
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

/**
 * PUT /students/:id — update student info and/or status. Every field is
 * optional, but at least one must be provided.
 */
export const updateStudentSchema = z
  .object({
    firstName: z.string().min(1, "First name cannot be empty").optional(),
    lastName: z.string().min(1, "Last name cannot be empty").optional(),
    birthDate: z.coerce.date().optional(),
    parentName: z.string().min(1, "Parent name cannot be empty").optional(),
    parentWhatsapp: whatsappSchema.optional(),
    status: z.nativeEnum(StudentStatus).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

/** Route param for /students/:id. Express gives strings, so coerce (CLAUDE.md). */
export const studentIdParamSchema = z.object({
  id: z.coerce.number().int().positive("A valid student id is required"),
});
export type StudentIdParam = z.infer<typeof studentIdParamSchema>;

/** GET /students?classId=&status= — optional list filters. */
export const listStudentsQuerySchema = z.object({
  classId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
});
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
