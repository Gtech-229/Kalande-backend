import { Role } from "@prisma/client";
import { db } from "../config/database";
import { env } from "../config/env";
import { hashPassword } from "../utils/password";
import logger from "../lib/logger";

/**
 * Seed: create the single Admin account.
 *
 * Reads credentials from env (never hardcode secrets — CLAUDE.md).
 * Enforces the one-admin rule: if an Admin already exists, it does nothing.
 * Run with: npm run db:seed
 */
async function main(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env to seed the admin"
    );
  }

  const existingAdmin = await db.user.findFirst({
    where: { role: Role.ADMIN, deletedAt: null },
  });
  if (existingAdmin) {
    logger.info(`Admin already exists (${existingAdmin.email}) — nothing to do`);
    return;
  }

  const password = await hashPassword(env.ADMIN_PASSWORD);
  const admin = await db.user.create({
    data: {
      name: env.ADMIN_NAME,
      email: env.ADMIN_EMAIL,
      password,
      role: Role.ADMIN,
    },
  });

  logger.info(`Created admin account: ${admin.email}`);
}

main()
  .catch((error) => {
    logger.error("Seed failed", { error });
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
