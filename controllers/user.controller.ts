import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as userService from "../services/user.service";
import type {
  CreateUserInput,
  ListUsersQuery,
  UserIdParam,
} from "../schemas/user.schema";

/**
 * User controllers — thin handlers (CLAUDE.md).
 * They extract the already-validated input, call ONE service method, and send
 * the response. No business logic, no try/catch.
 *
 * req.body / req.query are cast to the validated input type: the validate()
 * middleware has already parsed them, so this narrows Express's built-in types.
 */

/**
 * @description List active users, optionally filtered by ?role=
 * @route   GET /api/users
 * @access  ADMIN
 * **/

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const data = await userService.listUsers(req.query as unknown as ListUsersQuery);
  res.status(200).json({ success: true, data });
});

/**
 * @description Create a SUPERVISOR or OPERATOR account (no class yet)
 * @route   POST /api/users
 * @access  ADMIN
 * **/

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const data = await userService.createUser(req.body as CreateUserInput);
  res.status(201).json({ success: true, data });
});

/**
 * @description Regenerate the password and resend the welcome email
 * @route   POST /api/users/:id/resend-welcome
 * @access  ADMIN
 * **/

export const resendWelcomeEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as unknown as UserIdParam;
    await userService.resendWelcomeEmail(id);
    res
      .status(200)
      .json({ success: true, data: { message: "Welcome email resent" } });
  }
);
