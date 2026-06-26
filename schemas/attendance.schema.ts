import { z } from "zod";
import { AttendancePeriod } from "@prisma/client";

/**
 * Attendance request schemas. One file per domain (CLAUDE.md).
 * Each schema is exported together with its inferred input type — the single
 * source of truth for the attendance endpoints' input shape.
 */

/**
 * POST /attendance/submit — validate the whole call for the supervisor's class.
 * The client sends only the absent students; everyone else (active) is marked
 * present. The class is NOT taken from the body: it is derived from the
 * supervisor server-side, so a supervisor can only submit for their own class.
 * `date` defaults to today (set in the service) when omitted.
 */
export const submitAttendanceSchema = z.object({
  period: z.nativeEnum(AttendancePeriod),
  subject: z.string().min(1, "Subject is required"),
  date: z.coerce.date().optional(),
  absents: z
    .array(z.coerce.number().int().positive())
    .default([]),
});
export type SubmitAttendanceInput = z.infer<typeof submitAttendanceSchema>;

/**
 * GET /attendance/history?date=&period=&subject= — optional filters over the
 * supervisor's class history.
 */
export const attendanceHistoryQuerySchema = z.object({
  date: z.coerce.date().optional(),
  period: z.nativeEnum(AttendancePeriod).optional(),
  subject: z.string().min(1).optional(),
});
export type AttendanceHistoryQuery = z.infer<typeof attendanceHistoryQuerySchema>;
