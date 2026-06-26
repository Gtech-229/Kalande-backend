import { Role } from "@prisma/client";
import { db } from "../config/database";
import { AppError } from "../lib/AppError";

/**
 * Operator-class business logic. No Express types here (CLAUDE.md) — controllers
 * adapt HTTP to/from these plain typed objects.
 *
 * This manages the operator_classes pivot: which classes an OPERATOR is allowed
 * to enroll students into. The student service reads this pivot to authorize
 * enrollments (APP_CONTEXT.md).
 */

/** A class an operator is authorized for, as returned to the client. */
type AuthorizedClass = {
  classId: number;
  className: string;
  assignedAt: Date;
};

/** An operator that can still be assigned to a given class. */
type AvailableOperator = {
  id: number;
  name: string;
  email: string;
};

/**
 * Load the operator and confirm it is a usable OPERATOR account.
 * Throws AppError(404) if missing/deleted, AppError(400) if the wrong role.
 */
async function getOperatorOrThrow(operatorId: number): Promise<void> {
  const operator = await db.user.findFirst({
    where: { id: operatorId, deletedAt: null },
  });
  if (!operator) {
    throw new AppError(404, "OPERATOR_NOT_FOUND", "Operator not found");
  }
  if (operator.role !== Role.OPERATOR) {
    throw new AppError(
      400,
      "INVALID_OPERATOR",
      "User is not an OPERATOR account"
    );
  }
}

/**
 * List the classes an operator is authorized for.
 * Soft-deleted classes are excluded.
 */
export async function listOperatorClasses(
  operatorId: number
): Promise<AuthorizedClass[]> {
  await getOperatorOrThrow(operatorId);

  const rows = await db.operatorClass.findMany({
    where: { operatorId, class: { deletedAt: null } },
    orderBy: { class: { name: "asc" } },
    include: { class: { select: { id: true, name: true } } },
  });

  return rows.map((row) => ({
    classId: row.class.id,
    className: row.class.name,
    assignedAt: row.createdAt,
  }));
}

/**
 * List the OPERATORs that can still be assigned to a class — i.e. active
 * operators NOT already authorized for it. Powers the assignment picker on the
 * frontend so the admin only sees valid options.
 * Fails if the class does not exist (or is deleted).
 */
export async function listAvailableOperators(
  classId: number
): Promise<AvailableOperator[]> {
  const klass = await db.class.findFirst({
    where: { id: classId, deletedAt: null },
  });
  if (!klass) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }

  const operators = await db.user.findMany({
    where: {
      role: Role.OPERATOR,
      deletedAt: null,
      // Exclude operators that already have an authorization for this class.
      operatorClasses: { none: { classId } },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return operators;
}

/**
 * Authorize an operator to enroll students into a class.
 * - Fails if the operator does not exist or is not an OPERATOR.
 * - Fails if the class does not exist (or is deleted).
 * - Fails if the authorization already exists.
 */
export async function assignOperatorToClass(
  operatorId: number,
  classId: number
): Promise<AuthorizedClass> {
  await getOperatorOrThrow(operatorId);

  const klass = await db.class.findFirst({
    where: { id: classId, deletedAt: null },
  });
  if (!klass) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }

  const existing = await db.operatorClass.findUnique({
    where: { operatorId_classId: { operatorId, classId } },
  });
  if (existing) {
    throw new AppError(
      409,
      "ALREADY_ASSIGNED",
      "Operator is already authorized for this class"
    );
  }

  const created = await db.operatorClass.create({
    data: { operatorId, classId },
  });

  return {
    classId: klass.id,
    className: klass.name,
    assignedAt: created.createdAt,
  };
}

/**
 * Remove an operator's authorization for a class.
 * Fails if the authorization does not exist.
 */
export async function removeOperatorFromClass(
  operatorId: number,
  classId: number
): Promise<void> {
  const existing = await db.operatorClass.findUnique({
    where: { operatorId_classId: { operatorId, classId } },
  });
  if (!existing) {
    throw new AppError(
      404,
      "ASSIGNMENT_NOT_FOUND",
      "Operator is not authorized for this class"
    );
  }

  await db.operatorClass.delete({
    where: { operatorId_classId: { operatorId, classId } },
  });
}
