import { Role, AttendanceStatus, StudentStatus } from "@prisma/client";
import { db } from "../config/database";
import { toDateOnly } from "../utils/date";
import { getClassForSupervisor } from "./class.service";

/**
 * Dashboard business logic. No Express types here (CLAUDE.md) — controllers
 * adapt HTTP to/from these plain typed objects.
 *
 * Read-only aggregates: the admin sees the whole school, a supervisor sees only
 * their own class (resolved server-side).
 */

/** The supervisor performing the action (role is enforced by the route). */
type Actor = {
  userId: number;
};

/** Today's present/absent totals. */
type TodayAttendance = {
  date: Date;
  present: number;
  absent: number;
};

/** Whole-school stats for the admin. */
type AdminDashboard = {
  classes: number;
  students: { active: number; total: number };
  supervisors: number;
  operators: number;
  today: TodayAttendance;
};

/** A supervisor's class stats plus today's call status. */
type SupervisorDashboard = {
  class: { id: number; name: string };
  activeStudents: number;
  today: TodayAttendance & {
    submitted: boolean;
    sessions: number;
  };
};

/**
 * Whole-school stats for the admin: counts of classes, students (active/total),
 * supervisors, operators, and today's present/absent totals across all classes.
 */
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const today = toDateOnly(new Date());

  const [classes, activeStudents, totalStudents, supervisors, operators, present, absent] =
    await Promise.all([
      db.class.count({ where: { deletedAt: null } }),
      db.student.count({
        where: { deletedAt: null, status: StudentStatus.ACTIVE },
      }),
      db.student.count({ where: { deletedAt: null } }),
      db.user.count({ where: { deletedAt: null, role: Role.SUPERVISOR } }),
      db.user.count({ where: { deletedAt: null, role: Role.OPERATOR } }),
      db.attendance.count({
        where: { deletedAt: null, date: today, status: AttendanceStatus.PRESENT },
      }),
      db.attendance.count({
        where: { deletedAt: null, date: today, status: AttendanceStatus.ABSENT },
      }),
    ]);

  return {
    classes,
    students: { active: activeStudents, total: totalStudents },
    supervisors,
    operators,
    today: { date: today, present, absent },
  };
}

/**
 * A supervisor's dashboard: their class, its active student count, and today's
 * call status (whether anything was submitted, how many sessions, and the
 * present/absent totals).
 */
export async function getSupervisorDashboard(
  actor: Actor
): Promise<SupervisorDashboard> {
  const klass = await getClassForSupervisor(actor.userId);
  const today = toDateOnly(new Date());

  const [activeStudents, present, absent, sessions] = await Promise.all([
    db.student.count({
      where: {
        classId: klass.id,
        status: StudentStatus.ACTIVE,
        deletedAt: null,
      },
    }),
    db.attendance.count({
      where: {
        classId: klass.id,
        date: today,
        deletedAt: null,
        status: AttendanceStatus.PRESENT,
      },
    }),
    db.attendance.count({
      where: {
        classId: klass.id,
        date: today,
        deletedAt: null,
        status: AttendanceStatus.ABSENT,
      },
    }),
    // Distinct period+subject combinations recorded today = number of sessions.
    db.attendance.findMany({
      where: { classId: klass.id, date: today, deletedAt: null },
      distinct: ["period", "subject"],
      select: { period: true, subject: true },
    }),
  ]);

  return {
    class: klass,
    activeStudents,
    today: {
      date: today,
      present,
      absent,
      submitted: present + absent > 0,
      sessions: sessions.length,
    },
  };
}
