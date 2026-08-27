import { env } from "../config/env";

/**
 * Email templates — pure builders that render the subject/html/text of each
 * transactional email. Parent/user-facing copy is in French. Secrets (the
 * generated password, the reset token) are passed in as arguments and only ever
 * live in the returned strings; they are never stored.
 */

/** The rendered parts of an email, minus the recipient (the service adds `to`). */
export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/** Frontend link to the set/reset screen, carrying the one-time token + mode. */
function passwordLink(token: string, mode: "set" | "reset"): string {
  return `${env.APP_RESET_URL}?token=${token}&mode=${mode}`;
}

/**
 * Welcome email for a newly created account: contains a link to DEFINE the
 * password (no temporary password is issued anymore).
 */
export function buildWelcomeEmail(params: {
  name: string;
  token: string;
}): RenderedEmail {
  const subject = "Bienvenue sur ZASS — définissez votre mot de passe";
  const link = passwordLink(params.token, "set");

  const text =
    `Bonjour ${params.name},\n\n` +
    `Un compte ZASS a été créé pour vous.\n` +
    `Ouvrez ce lien pour définir votre mot de passe (valable 7 jours) :\n` +
    `${link}\n\n` +
    `Vous pourrez ensuite vous connecter et configurer votre code PIN.`;

  const html =
    `<p>Bonjour ${params.name},</p>` +
    `<p>Un compte ZASS a été créé pour vous.</p>` +
    `<p><a href="${link}">Définir mon mot de passe</a> (lien valable 7 jours).</p>` +
    `<p>Vous pourrez ensuite vous connecter et configurer votre code PIN.</p>`;

  return { subject, html, text };
}

/**
 * Password reset email: contains a link to the frontend reset screen carrying
 * the one-time token.
 */
export function buildPasswordResetEmail(params: {
  name: string;
  token: string;
}): RenderedEmail {
  const subject = "Réinitialisation de votre mot de passe ZASS";
  const link = passwordLink(params.token, "reset");

  const text =
    `Bonjour ${params.name},\n\n` +
    `Vous avez demandé à réinitialiser votre mot de passe.\n` +
    `Ouvrez ce lien pour en choisir un nouveau (valable 1 heure) :\n` +
    `${link}\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;

  const html =
    `<p>Bonjour ${params.name},</p>` +
    `<p>Vous avez demandé à réinitialiser votre mot de passe.</p>` +
    `<p><a href="${link}">Choisir un nouveau mot de passe</a> (lien valable 1 heure).</p>` +
    `<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`;

  return { subject, html, text };
}
