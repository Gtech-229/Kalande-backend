import { Prisma, Role, StudentStatus } from "@prisma/client";
import { db } from "../config/database";
import { AppError } from "../lib/AppError";
import type {
  CreateStudentInput,
  UpdateStudentInput,
  ListStudentsQuery,
} from "../schemas/student.schema";

/**
 * Student business logic. No Express types here (CLAUDE.md) — controllers adapt
 * HTTP to/from these plain typed objects.
 *
 * Input is already validated by the validate() middleware against the student
 * schema, so we only enforce business rules (existence, authorization) here.
 */

/**
 * Who is performing the action. The controller builds this from req.user; the
 * service stays free of Express types. We need the role to authorize OPERATORs
 * and the id to stamp `createdBy` on enrollment.
 */
type Actor = {
  userId: number;
  role: Role;
};

/** A student as returned to the client. */
type PublicStudent = {
  id: number;
  classId: number;
  firstName: string;
  lastName: string;
  birthDate: Date;
  parentName: string;
  parentWhatsapp: string;
  status: StudentStatus;
  createdById: number | null;
  createdAt: Date;
};

/** Strip a Student row down to the safe public shape. */
function toPublicStudent(student: PublicStudent): PublicStudent {
  return {
    id: student.id,
    classId: student.classId,
    firstName: student.firstName,
    lastName: student.lastName,
    birthDate: student.birthDate,
    parentName: student.parentName,
    parentWhatsapp: student.parentWhatsapp,
    status: student.status,
    createdById: student.createdById,
    createdAt: student.createdAt,
  };
}

/**
 * Ensure the actor may enroll/modify students in this class.
 * - ADMIN: allowed in any class.
 * - OPERATOR: allowed only in classes listed in operator_classes.
 * Throws AppError(403) otherwise. (SUPERVISOR never reaches here — the route
 * only allows ADMIN and OPERATOR.)
 */
async function assertCanManageClass(actor: Actor, classId: number): Promise<void> {
  if (actor.role === Role.ADMIN) {
    return;
  }

  const authorization = await db.operatorClass.findUnique({
    where: {
      operatorId_classId: { operatorId: actor.userId, classId },
    },
  });
  if (!authorization) {
    throw new AppError(
      403,
      "NOT_AUTHORIZED_FOR_CLASS",
      "You are not authorized to manage students in this class"
    );
  }
}

/**
 * Enroll a new student. A new student is always ACTIVE (DB default).
 * - Fails if the target class does not exist (or is deleted).
 * - An OPERATOR may only enroll into classes they are authorized for.
 */
export async function createStudent(
  input: CreateStudentInput,
  actor: Actor
): Promise<PublicStudent> {
  const klass = await db.class.findFirst({
    where: { id: input.classId, deletedAt: null },
  });
  if (!klass) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }

  await assertCanManageClass(actor, input.classId);

  const student = await db.student.create({
    data: {
      classId: input.classId,
      firstName: input.firstName,
      lastName: input.lastName,
      birthDate: input.birthDate,
      parentName: input.parentName,
      parentWhatsapp: input.parentWhatsapp,
      createdById: actor.userId,
    },
  });

  return toPublicStudent(student);
}

/**
 * List active (non-deleted) students, optionally filtered by class and status.
 * The call list uses classId + status=ACTIVE (APP_CONTEXT.md).
 */
export async function listStudents(
  filter: ListStudentsQuery
): Promise<PublicStudent[]> {
  const where: Prisma.StudentWhereInput = { deletedAt: null };
  if (filter.classId !== undefined) {
    where.classId = filter.classId;
  }
  if (filter.status) {
    where.status = filter.status;
  }

  const students = await db.student.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return students.map(toPublicStudent);
}

/**
 * Update a student's info and/or status.
 * - Fails if the student does not exist (or is deleted).
 * - An OPERATOR may only modify students in classes they are authorized for.
 */
export async function updateStudent(
  id: number,
  input: UpdateStudentInput,
  actor: Actor
): Promise<PublicStudent> {
  const student = await db.student.findFirst({
    where: { id, deletedAt: null },
  });
  if (!student) {
    throw new AppError(404, "STUDENT_NOT_FOUND", "Student not found");
  }

  await assertCanManageClass(actor, student.classId);

  const updated = await db.student.update({
    where: { id },
    data: input,
  });

  return toPublicStudent(updated);
}
