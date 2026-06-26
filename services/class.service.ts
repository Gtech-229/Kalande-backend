import { Role } from "@prisma/client";
import { db } from "../config/database";
import { AppError } from "../lib/AppError";
import type { CreateClassInput } from "../schemas/class.schema";

/**
 * Class business logic. No Express types here (CLAUDE.md) — controllers adapt
 * HTTP to/from these plain typed objects.
 *
 * Input is already validated by the validate() middleware against the class
 * schema, so we only enforce business rules (uniqueness, existence) here.
 */

/** Supervisor fields safe to expose (never the password). */
type PublicSupervisor = {
  id: number;
  name: string;
  email: string;
};

/**
 * Resolve the class a supervisor runs (1 supervisor = 1 class). Shared by the
 * attendance and dashboard services. Throws if the supervisor has no class.
 */
export async function getClassForSupervisor(
  supervisorId: number
): Promise<{ id: number; name: string }> {
  const klass = await db.class.findFirst({
    where: { supervisorId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!klass) {
    throw new AppError(
      403,
      "NO_CLASS_ASSIGNED",
      "You are not assigned to a class"
    );
  }
  return klass;
}

/** A class as returned to the client, with its supervisor (if any). */
type ClassWithSupervisor = {
  id: number;
  name: string;
  createdAt: Date;
  supervisor: PublicSupervisor | null;
};

/** Shape Prisma returns when we include the supervisor relation. */
type ClassRow = {
  id: number;
  name: string;
  createdAt: Date;
  supervisor: { id: number; name: string; email: string } | null;
};

/** Map a Prisma class row to the safe public shape. */
function toClassWithSupervisor(row: ClassRow): ClassWithSupervisor {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    supervisor: row.supervisor
      ? {
          id: row.supervisor.id,
          name: row.supervisor.name,
          email: row.supervisor.email,
        }
      : null,
  };
}

/**
 * List every active (non-deleted) class with its supervisor.
 * Admin-only view of the whole school.
 */
export async function listClasses(): Promise<ClassWithSupervisor[]> {
  const classes = await db.class.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      supervisor: { select: { id: true, name: true, email: true } },
    },
  });

  return classes.map(toClassWithSupervisor);
}

/**
 * Create a class and assign an EXISTING, unassigned supervisor to it.
 * The supervisor account is created beforehand (independently, with no class);
 * here the client only sends its id. We validate, in order:
 * - Fails if the class name is already taken.
 * - Fails if no such (active) user exists.
 * - Fails if the user is not a SUPERVISOR — an ADMIN/OPERATOR must never
 *   supervise a class (APP_CONTEXT.md).
 * - Fails if that supervisor already runs another class (1 supervisor = 1 class).
 */
export async function createClass(
  input: CreateClassInput
): Promise<ClassWithSupervisor> {
  const nameTaken = await db.class.findUnique({
    where: { name: input.name },
  });
  if (nameTaken) {
    throw new AppError(409, "CLASS_NAME_TAKEN", "Class name already exists");
  }

  const supervisor = await db.user.findFirst({
    where: { id: input.supervisorId, deletedAt: null },
  });
  if (!supervisor) {
    throw new AppError(404, "SUPERVISOR_NOT_FOUND", "Supervisor not found");
  }
  if (supervisor.role !== Role.SUPERVISOR) {
    throw new AppError(
      400,
      "INVALID_SUPERVISOR",
      "Selected user must be a SUPERVISOR account"
    );
  }

  const alreadyAssigned = await db.class.findFirst({
    where: { supervisorId: supervisor.id, deletedAt: null },
  });
  if (alreadyAssigned) {
    throw new AppError(
      409,
      "SUPERVISOR_ALREADY_ASSIGNED",
      "This supervisor already runs another class"
    );
  }

  // Two tables (class + user) -> single transaction (CLAUDE.md).
  const klass = await db.$transaction(async (tx) => {
    const created = await tx.class.create({
      data: {
        name: input.name,
        supervisorId: supervisor.id,
      },
    });

    // Set the supervisor's home class so login can auto-load it later.
    await tx.user.update({
      where: { id: supervisor.id },
      data: { classId: created.id },
    });

    return created;
  });

  return toClassWithSupervisor({
    id: klass.id,
    name: klass.name,
    createdAt: klass.createdAt,
    supervisor: {
      id: supervisor.id,
      name: supervisor.name,
      email: supervisor.email,
    },
  });
}

/**
 * Soft-delete a class by id (set deletedAt — never hard delete, CLAUDE.md).
 * Frees its supervisor in the same transaction (clears the class link on both
 * sides) so that supervisor can be assigned to a new class afterwards.
 * Fails if the class does not exist (or is already deleted).
 *
 * NOTE: APP_CONTEXT.md requires blocking deletion when the class still has
 * students. That guard will be added here once the students domain exists.
 */
export async function deleteClass(id: number): Promise<void> {
  const klass = await db.class.findFirst({
    where: { id, deletedAt: null },
  });
  if (!klass) {
    throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
  }

  // Two tables (class + the supervisor's user row) -> single transaction.
  await db.$transaction(async (tx) => {
    // Detach the supervisor's home class, if there is one.
    if (klass.supervisorId !== null) {
      await tx.user.update({
        where: { id: klass.supervisorId },
        data: { classId: null },
      });
    }

    // Soft-delete and release the supervisor slot (clears the unique link).
    await tx.class.update({
      where: { id },
      data: { deletedAt: new Date(), supervisorId: null },
    });
  });
}
