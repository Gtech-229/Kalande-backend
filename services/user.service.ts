import { Prisma, Role } from "@prisma/client";
import { db } from "../config/database";
import { AppError } from "../lib/AppError";
import { hashPassword } from "../utils/password";
import { generatePassword } from "../utils/generate-password";
import { sendWelcomeEmail } from "./email.service";
import type {
  CreateUserInput,
  ListUsersQuery,
} from "../schemas/user.schema";

/**
 * User business logic. No Express types here (CLAUDE.md) — controllers adapt
 * HTTP to/from these plain typed objects.
 *
 * Input is already validated by the validate() middleware against the user
 * schema, so we only enforce business rules (uniqueness) here.
 */

/** The user fields we are allowed to expose (never the password). */
type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  classId: number | null;
};

/** Strip a User row down to the safe public shape. */
function toPublicUser(user: {
  id: number;
  name: string;
  email: string;
  role: Role;
  classId: number | null;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    classId: user.classId,
  };
}

/**
 * Create a SUPERVISOR or OPERATOR account with no class yet (classId = null).
 * The schema already blocks ADMIN, so we only check the email is free.
 *
 * The password is generated here (never sent by the client). We store only its
 * hash; the plaintext is emailed to the user in their welcome message.
 */
export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const emailTaken = await db.user.findUnique({
    where: { email: input.email },
  });
  if (emailTaken) {
    throw new AppError(409, "EMAIL_TAKEN", "Email already registered");
  }

  // Generate the password server-side and store only its bcrypt hash.
  const temporaryPassword = generatePassword();
  const password = await hashPassword(temporaryPassword);

  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      password,
      role: input.role,
    },
  });

  // Email the credentials. Failure-safe: a send error is recorded as a FAILED
  // EmailLog (resend later), so it never breaks account creation.
  await sendWelcomeEmail({
    userId: user.id,
    to: user.email,
    name: user.name,
    password: temporaryPassword,
  });

  return toPublicUser(user);
}

/**
 * Resend the welcome email for an existing SUPERVISOR/OPERATOR account.
 * The original password is unrecoverable (only its hash is stored), so this
 * generates a NEW password, stores its hash, and emails the new one.
 */
export async function resendWelcomeEmail(userId: number): Promise<void> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }
  if (user.role === Role.ADMIN) {
    throw new AppError(
      400,
      "INVALID_TARGET",
      "Welcome emails are only for supervisor/operator accounts"
    );
  }

  const newTemporaryPassword = generatePassword();
  const newPasswordHash = await hashPassword(newTemporaryPassword);

  await db.user.update({
    where: { id: user.id },
    data: { password: newPasswordHash },
  });

  await sendWelcomeEmail({
    userId: user.id,
    to: user.email,
    name: user.name,
    password: newTemporaryPassword,
  });
}

/**
 * List active (non-deleted) users, optionally filtered by role and assignment.
 * Used by the client to fetch users per role (e.g. supervisors to assign) and,
 * with assigned=false, only those not yet linked to a class.
 */
export async function listUsers(filter: ListUsersQuery): Promise<PublicUser[]> {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (filter.role) {
    where.role = filter.role;
  }
  if (filter.assigned !== undefined) {
    // assigned=true -> has a home class; assigned=false -> no class yet.
    where.classId = filter.assigned ? { not: null } : null;
  }

  const users = await db.user.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return users.map(toPublicUser);
}
