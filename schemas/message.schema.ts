import { z } from "zod";
import { MessageStatus, MessageType } from "@prisma/client";

/**
 * Message request schemas. One file per domain (CLAUDE.md).
 * Each schema is exported together with its inferred input type — the single
 * source of truth for the messaging endpoints' input shape.
 */

/** The message body shared by every send target. */
const messageBody = z
  .string()
  .min(1, "Message text is required")
  .max(4000, "Message is too long");

/**
 * POST /messages/send — discriminated union on `target`:
 * - parent: one student's parent.
 * - class:  every parent in a class.
 * - school: every parent in the school (admin only — enforced in the service).
 * The recipients are resolved server-side from the id; the client never sends
 * phone numbers.
 */
export const sendMessageSchema = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("parent"),
    studentId: z.coerce.number().int().positive("A valid student id is required"),
    message: messageBody,
  }),
  z.object({
    target: z.literal("class"),
    classId: z.coerce.number().int().positive("A valid class id is required"),
    message: messageBody,
  }),
  z.object({
    target: z.literal("school"),
    message: messageBody,
  }),
]);
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** GET /messages/history?status=&type=&studentId= — optional filters. */
export const messageHistoryQuerySchema = z.object({
  status: z.nativeEnum(MessageStatus).optional(),
  type: z.nativeEnum(MessageType).optional(),
  studentId: z.coerce.number().int().positive().optional(),
});
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;
