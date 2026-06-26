import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import logger from "../lib/logger";

/**
 * SMTP transporter (external service client), created ONCE from env — the email
 * equivalent of config/database.ts.
 *
 * Null when SMTP is not configured (no SMTP_HOST). In that case the email
 * provider falls back to the log-only stub, so development works without
 * credentials and nothing is actually sent.
 */
export const mailTransporter: Transporter | null = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    })
  : null;

/**
 * Check the SMTP connection at startup and log the result. Never throws — a bad
 * mail config must not stop the API from booting; failed sends are recorded as
 * FAILED EmailLog rows and can be resent.
 */
export async function verifyEmailTransport(): Promise<void> {
  if (!mailTransporter) {
    logger.warn("SMTP not configured — emails use the log-only provider");
    return;
  }

  try {
    await mailTransporter.verify();
    logger.info("SMTP transporter ready");
  } catch (error) {
    logger.error("SMTP verification failed — emails may not send", { error });
  }
}
