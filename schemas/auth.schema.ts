import { z } from "zod";

/**
 * Auth request schemas. One file per domain (CLAUDE.md).
 * Each schema is exported together with its inferred input type.
 */

export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caracteres')
  .regex(/[A-Z]/, 'Au moins une majuscule')
  .regex(/[0-9]/, 'Au moins un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Au moins un caractère spécial')


// Add the system admin . `role` is NOT accepted from the client: the service always sets ADMIN.
export const registerSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Entrez une adresse email valide"),
  password: z.string().min(8, "Password must be at least "),
});
export type RegisterInput = z.infer<typeof registerSchema>;

//Login with credentials
export const loginSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

// POST /auth/refresh — exchange a valid refresh token for a new access token.
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

// POST /auth/logout — revoke a refresh token (delete it from the DB).
export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

// POST /auth/forgot-password — start a reset: email the user a reset token.
export const forgotPasswordSchema = z.object({
  email: z.string().email("A valid email is required"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// POST /auth/reset-password — finish a reset with the emailed token.
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// POST /auth/change-password — authenticated user changes their own password.
// currentPassword is only checked for a match, so it is not re-validated for
// format (the user set it under whatever rules applied then).
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
