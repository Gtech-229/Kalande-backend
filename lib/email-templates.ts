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

/**
 * Welcome email for a newly created account: contains the temporary password the
 * user logs in with (and should change afterwards).
 */
export function buildWelcomeEmail(params: {
  name: string;
  email: string;
  password: string;
}): RenderedEmail {
  const subject = "Bienvenue sur ZASS — vos identifiants de connexion";

  const text =
    `Bonjour ${params.name},\n\n` +
    `Un compte ZASS a été créé pour vous.\n\n` +
    `Email : ${params.email}\n` +
    `Mot de passe provisoire : ${params.password}\n\n` +
    `Connectez-vous puis changez votre mot de passe dès que possible.`;

  const html =
    `<p>Bonjour ${params.name},</p>` +
    `<p>Un compte ZASS a été créé pour vous.</p>` +
    `<p><strong>Email :</strong> ${params.email}<br/>` +
    `<strong>Mot de passe provisoire :</strong> ${params.password}</p>` +
    `<p>Connectez-vous puis changez votre mot de passe dès que possible.</p>`;

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
  const resetLink = `${env.APP_RESET_URL}?token=${params.token}`;

  const text =
    `Bonjour ${params.name},\n\n` +
    `Vous avez demandé à réinitialiser votre mot de passe.\n` +
    `Ouvrez ce lien pour en choisir un nouveau (valable 1 heure) :\n` +
    `${resetLink}\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;

  const html =
    `<p>Bonjour ${params.name},</p>` +
    `<p>Vous avez demandé à réinitialiser votre mot de passe.</p>` +
    `<p><a href="${resetLink}">Choisir un nouveau mot de passe</a> (lien valable 1 heure).</p>` +
    `<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`;

  return { subject, html, text };
}
