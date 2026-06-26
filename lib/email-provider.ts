import logger from "./logger";
import { env } from "../config/env";
import { mailTransporter } from "../config/email";

/**
 * Email provider seam.
 *
 * The email service talks to THIS interface, never to a concrete mailer. That
 * keeps the domain free of nodemailer/SMTP/API details and lets us swap the
 * transport (log stub vs real SMTP) at a single point.
 */

/** A fully-rendered email ready to send. */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailProvider = {
  /**
   * Send one email. Throws on failure — the email service catches it and records
   * a FAILED EmailLog, so a send failure never breaks the caller.
   */
  sendEmail(message: EmailMessage): Promise<void>;
};

/**
 * Log-only provider. Pretends every email succeeds and logs ONLY the recipient
 * and subject — never the body, which carries the password / reset token. Lets
 * the whole flow run and be tested without real SMTP credentials. Replace
 * `emailProvider` below with the real mailer when wiring the integration.
 */
export const logEmailProvider: EmailProvider = {
  async sendEmail(message: EmailMessage): Promise<void> {
    logger.info("Email (stub provider)", {
      to: message.to,
      subject: message.subject,
    });

    console.log(message)
  },
};

/**
 * Real SMTP provider (nodemailer). Sends through the configured transporter.
 * Throws on any SMTP failure, which the email service catches and records.
 */
export const nodemailerEmailProvider: EmailProvider = {
  async sendEmail(message: EmailMessage): Promise<void> {
    if (!mailTransporter) {
      // Should never happen: we only select this provider when SMTP is set up.
      throw new Error("SMTP transporter is not configured");
    }

    await mailTransporter.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  },
};

/**
 * The provider the app uses: real SMTP when configured (SMTP_HOST set), else the
 * log-only stub so development works without credentials. Single swap point.
 */
export const emailProvider: EmailProvider = mailTransporter
  ? nodemailerEmailProvider
  : logEmailProvider;
