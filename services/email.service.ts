import { EmailType, EmailStatus } from "@prisma/client";
import { db } from "../config/database";
import logger from "../lib/logger";
import { emailProvider } from "../lib/email-provider";
import {
  buildWelcomeEmail,
  buildPasswordResetEmail,
  type RenderedEmail,
} from "../lib/email-templates";

/**
 * Email business logic. No Express types here (CLAUDE.md).
 *
 * This is a "dumb" sender: it renders a template, hands it to the provider, and
 * records an EmailLog. It NEVER regenerates secrets and never imports the user
 * or auth services — the secret (password / reset token) is always passed in by
 * the caller (avoids a circular dependency). Sends are failure-safe: a provider
 * error is logged and recorded, never thrown, so the calling flow (createUser,
 * forgotPassword) still succeeds.
 */

/** Turn an unknown thrown value into a storable message. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Render + send + record. Swallows every failure so the caller is never broken:
 * a failed send becomes a FAILED EmailLog the admin can later resend.
 */
async function deliver(args: {
  to: string;
  content: RenderedEmail;
  type: EmailType;
  userId: number;
}): Promise<void> {
  let status: EmailStatus = EmailStatus.SENT;
  let error: string | null = null;

  try {
    await emailProvider.sendEmail({ to: args.to, ...args.content });
  } catch (sendError) {
    status = EmailStatus.FAILED;
    error = errorMessage(sendError);
    logger.error("Email send failed", { to: args.to, type: args.type, error });
  }

  try {
    await db.emailLog.create({
      data: {
        recipient: args.to,
        type: args.type,
        status,
        error,
        sentAt: status === EmailStatus.SENT ? new Date() : null,
        userId: args.userId,
      },
    });
  } catch (logError) {
    // Even the audit write failing must not break the caller.
    logger.error("Failed to record EmailLog", { error: logError });
  }
}

/** Send the welcome email carrying a new account's temporary password. */
export async function sendWelcomeEmail(params: {
  userId: number;
  to: string;
  name: string;
  password: string;
}): Promise<void> {
  const content = buildWelcomeEmail({
    name: params.name,
    email: params.to,
    password: params.password,
  });
  await deliver({
    to: params.to,
    content,
    type: EmailType.WELCOME,
    userId: params.userId,
  });
}

/** Send the password reset email carrying a one-time token link. */
export async function sendPasswordResetEmail(params: {
  userId: number;
  to: string;
  name: string;
  token: string;
}): Promise<void> {
  const content = buildPasswordResetEmail({
    name: params.name,
    token: params.token,
  });
  await deliver({
    to: params.to,
    content,
    type: EmailType.PASSWORD_RESET,
    userId: params.userId,
  });
}
