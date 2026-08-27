import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as authService from "../services/auth.service";
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
  LogoutInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  PasswordModeQuery,
} from "../schemas/auth.schema";

/**
 * Auth controllers — thin handlers (CLAUDE.md).
 * They extract the already-validated input, call ONE service method, and send
 * the response. No business logic, no try/catch.
 *
 * req.body is cast to the validated input type: the validate() middleware has
 * already parsed it, so this narrows Express's built-in `any`.
 */

/**
 * @description Register the single system Admin account and auto-log-in (returns user + token pair)
 * @route   POST /api/auth/register
 * @access  Public
 * **/

export const register = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.register(req.body as RegisterInput);
  res.status(201).json({ success: true, data });
});

/**
 * @description Log in with email + password, returns the user plus a fresh token pair
 * @route   POST /api/auth/login
 * @access  Public
 * **/

export const login = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.login(req.body as LoginInput);
  res.status(200).json({ success: true, data });
});

/**
 * @description Exchange a valid refresh token for a new token pair (rotation)
 * @route   POST /api/auth/refresh
 * @access  Public (identifies the user via the refresh token in the body)
 * **/

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.refresh(req.body as RefreshInput);
  res.status(200).json({ success: true, data });
});

/**
 * @description Sign out by revoking the given refresh token (delete its DB row)
 * @route   POST /api/auth/logout
 * @access  Public (identifies the user via the refresh token in the body)
 * **/

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.body as LogoutInput);
  res.status(200).json({ success: true, data: { message: "Logged out" } });
});

/**
 * @description Start a set/reset — emails the matching link if the account exists
 * @route   POST /api/auth/forgot-password?mode=set|reset
 * @access  Public
 * **/

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { mode } = req.query as unknown as PasswordModeQuery;
    await authService.forgotPassword(req.body as ForgotPasswordInput, mode);
    // Always the same response, whether or not the email exists (no enumeration).
    res.status(200).json({
      success: true,
      data: { message: "If the account exists, an email has been sent" },
    });
  }
);

/**
 * @description Finish a set/reset using the emailed token
 * @route   POST /api/auth/reset-password?mode=set|reset
 * @access  Public
 * **/

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { mode } = req.query as unknown as PasswordModeQuery;
    await authService.resetPassword(req.body as ResetPasswordInput);
    res.status(200).json({
      success: true,
      data: {
        message: mode === "set" ? "Password defined" : "Password updated",
      },
    });
  }
);

/**
 * @description Change the authenticated user's own password
 * @route   POST /api/auth/change-password
 * @access  Authenticated
 * **/

export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    await authService.changePassword(
      req.user!.userId,
      req.body as ChangePasswordInput
    );
    res.status(200).json({ success: true, data: { message: "Password updated" } });
  }
);
