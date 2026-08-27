import { Prisma, Role, PasswordTokenType } from "@prisma/client";
import { db } from "../config/database";
import { AppError } from "../lib/AppError";
import { hashPassword } from "../utils/password";
import { generatePassword } from "../utils/generate-password";
import { sendWelcomeEmail } from "./email.service";
import { issuePasswordToken } from "./auth.service";
import { paginate, pageSkip, type Paginated } from "../utils/pagination";
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
  mustChangePassword: boolean;
};

/** Strip a User row down to the safe public shape. */
function toPublicUser(user: {
  id: number;
  name: string;
  email: string;
  role: Role;
  classId: number | null;
  mustChangePassword: boolean;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    classId: user.classId,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Create a SUPERVISOR or OPERATOR account with no class yet (classId = null).
 * The schema already blocks ADMIN, so we only check the email is free.
 *
 * No password is sent to the client and no temporary password is emailed: we
 * store an unusable random placeholder hash (so nobody can log in until the
 * account is set up), then email a welcome link that lets the user DEFINE their
 * own password (a single-use SET token).
 */
export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const emailTaken = await db.user.findUnique({
    where: { email: input.email },
  });
  if (emailTaken) {
    throw new AppError(409, "EMAIL_TAKEN", "Email already registered");
  }

  // Unusable placeholder — the real password is defined via the welcome link.
  const placeholderPassword = await hashPassword(generatePassword());

  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: placeholderPassword,
      role: input.role,
      // Until they define their own password via the welcome link.
      mustChangePassword: true,
    },
  });

  // Issue a SET token and email the welcome + set-password link. Failure-safe:
  // a send error is recorded as a FAILED EmailLog (resend later), so it never
  // breaks account creation.
  const token = await issuePasswordToken(user.id, PasswordTokenType.SET);
  await sendWelcomeEmail({
    userId: user.id,
    to: user.email,
    name: user.name,
    token,
  });

  return toPublicUser(user);
}

/**
 * Resend the welcome (set-password) email for an existing SUPERVISOR/OPERATOR
 * account: issues a fresh SET token and emails the link again. Does NOT touch
 * the stored password.
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

  const token = await issuePasswordToken(user.id, PasswordTokenType.SET);
  await sendWelcomeEmail({
    userId: user.id,
    to: user.email,
    name: user.name,
    token,
  });
}

/**
 * List active (non-deleted) users, optionally filtered by role and assignment.
 * Used by the client to fetch users per role (e.g. supervisors to assign) and,
 * with assigned=false, only those not yet linked to a class.
 */
export async function listUsers(
  filter: ListUsersQuery
): Promise<Paginated<PublicUser>> {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (filter.role) {
    where.role = filter.role;
  }
  if (filter.assigned !== undefined) {
    // assigned=true -> has a home class; assigned=false -> no class yet.
    where.classId = filter.assigned ? { not: null } : null;
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip: pageSkip(filter.page, filter.limit),
      take: filter.limit,
    }),
    db.user.count({ where }),
  ]);

  return paginate(users.map(toPublicUser), total, filter.page, filter.limit);
}
