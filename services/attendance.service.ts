import {
  Prisma,
  AttendanceStatus,
  AttendancePeriod,
  StudentStatus,
} from "@prisma/client";
import { db } from "../config/database";
import { AppError } from "../lib/AppError";
import { toDateOnly } from "../utils/date";
import { getClassForSupervisor } from "./class.service";
import { queueAbsenceAlerts } from "./message.service";
import type {
  SubmitAttendanceInput,
  AttendanceHistoryQuery,
} from "../schemas/attendance.schema";

/**
 * Attendance business logic. No Express types here (CLAUDE.md) — controllers
 * adapt HTTP to/from these plain typed objects.
 *
 * These endpoints are supervisor-centric: a supervisor works only on the class
 * they run. The class is always resolved from the supervisor server-side (never
 * trusted from the request body), so a supervisor can never act on another
 * class.
 */

/** The supervisor performing the action (role is enforced by the route). */
type Actor = {
  userId: number;
};

/** A student in the call list. */
type CallListStudent = {
  id: number;
  firstName: string;
  lastName: string;
  parentName: string;
  parentWhatsapp: string;
};

/** Result of submitting a call. */
type AttendanceSummary = {
  classId: number;
  className: string;
  period: AttendancePeriod;
  subject: string;
  date: Date;
  total: number;
  presentCount: number;
  absentCount: number;
  absentStudentIds: number[];
};

/** One history row, with the student it refers to. */
type AttendanceHistoryRow = {
  id: number;
  studentId: number;
  studentName: string;
  status: AttendanceStatus;
  period: AttendancePeriod;
  subject: string;
  date: Date;
};

/**
 * The active students of the supervisor's class — the call list.
 * Only ACTIVE students are called (APP_CONTEXT.md).
 */
export async function listCallListStudents(
  actor: Actor
): Promise<CallListStudent[]> {
  const klass = await getClassForSupervisor(actor.userId);

  const students = await db.student.findMany({
    where: {
      classId: klass.id,
      status: StudentStatus.ACTIVE,
      deletedAt: null,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentName: true,
      parentWhatsapp: true,
    },
  });

  return students;
}

/**
 * Validate the whole call for the supervisor's class in one shot.
 * - Marks every active student PRESENT, except those in `absents` (ABSENT).
 * - Rejects absent ids that are not active students of this class.
 * - Rejects a duplicate submission (same class, period, subject and date) — the
 *   unique constraint is the ultimate guard, this check just gives a clean 409.
 */
export async function submitAttendance(
  input: SubmitAttendanceInput,
  actor: Actor
): Promise<AttendanceSummary> {
  const klass = await getClassForSupervisor(actor.userId);
  const date = toDateOnly(input.date ?? new Date());

  const activeStudents = await db.student.findMany({
    where: {
      classId: klass.id,
      status: StudentStatus.ACTIVE,
      deletedAt: null,
    },
    // Names + phone are needed to compose the absence alerts below.
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentWhatsapp: true,
    },
  });
  if (activeStudents.length === 0) {
    throw new AppError(
      400,
      "NO_ACTIVE_STUDENTS",
      "This class has no active students to call"
    );
  }

  const activeIds = new Set(activeStudents.map((student) => student.id));
  const absentIds = new Set(input.absents);

  // Every absent must be an active student of this class.
  for (const absentId of absentIds) {
    if (!activeIds.has(absentId)) {
      throw new AppError(
        400,
        "INVALID_ABSENT_STUDENT",
        `Student ${absentId} is not an active student of this class`
      );
    }
  }

  // Clean 409 if the call was already submitted for this session.
  const existing = await db.attendance.findFirst({
    where: {
      classId: klass.id,
      period: input.period,
      subject: input.subject,
      date,
    },
  });
  if (existing) {
    throw new AppError(
      409,
      "ATTENDANCE_ALREADY_SUBMITTED",
      "The call for this period, subject and date was already submitted"
    );
  }

  const rows = activeStudents.map((student) => ({
    studentId: student.id,
    classId: klass.id,
    submittedById: actor.userId,
    status: absentIds.has(student.id)
      ? AttendanceStatus.ABSENT
      : AttendanceStatus.PRESENT,
    period: input.period,
    subject: input.subject,
    date,
  }));

  try {
    await db.attendance.createMany({ data: rows });
  } catch (error) {
    // Backstop for a race that slipped past the check above.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        409,
        "ATTENDANCE_ALREADY_SUBMITTED",
        "The call for this period, subject and date was already submitted"
      );
    }
    throw error;
  }

  // Queue the parent absence alerts (sent asynchronously by the message worker,
  // paced for anti-spam — APP_CONTEXT.md). Submitting the call stays fast.
  const absentStudents = activeStudents.filter((student) =>
    absentIds.has(student.id)
  );
  await queueAbsenceAlerts({
    students: absentStudents,
    subject: input.subject,
    date,
    sentById: actor.userId,
  });

  const absentStudentIds = absentStudents.map((student) => student.id);

  return {
    classId: klass.id,
    className: klass.name,
    period: input.period,
    subject: input.subject,
    date,
    total: activeStudents.length,
    presentCount: activeStudents.length - absentStudentIds.length,
    absentCount: absentStudentIds.length,
    absentStudentIds,
  };
}

/**
 * The supervisor's class attendance history, optionally filtered by date,
 * period and subject. Most recent first.
 */
export async function getAttendanceHistory(
  filter: AttendanceHistoryQuery,
  actor: Actor
): Promise<AttendanceHistoryRow[]> {
  const klass = await getClassForSupervisor(actor.userId);

  const where: Prisma.AttendanceWhereInput = {
    classId: klass.id,
    deletedAt: null,
  };
  if (filter.date) {
    where.date = toDateOnly(filter.date);
  }
  if (filter.period) {
    where.period = filter.period;
  }
  if (filter.subject) {
    where.subject = filter.subject;
  }

  const records = await db.attendance.findMany({
    where,
    orderBy: [{ date: "desc" }, { subject: "asc" }],
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  });

  return records.map((record) => ({
    id: record.id,
    studentId: record.studentId,
    studentName: `${record.student.firstName} ${record.student.lastName}`,
    status: record.status,
    period: record.period,
    subject: record.subject,
    date: record.date,
  }));
}
