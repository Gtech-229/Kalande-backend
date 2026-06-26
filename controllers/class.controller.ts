import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as classService from "../services/class.service";
import type {
  CreateClassInput,
  ClassIdParam,
} from "../schemas/class.schema";

/**
 * Class controllers — thin handlers (CLAUDE.md).
 * They extract the already-validated input, call ONE service method, and send
 * the response. No business logic, no try/catch.
 *
 * req.body / req.params are cast to the validated input type: the validate()
 * middleware has already parsed them, so this narrows Express's built-in `any`.
 */

/**
 * @description List every active class with its supervisor
 * @route   GET /api/classes
 * @access  ADMIN
 * **/

export const listClasses = asyncHandler(async (_req: Request, res: Response) => {
  const data = await classService.listClasses();
  res.status(200).json({ success: true, data });
});

/**
 * @description Create a class together with its SUPERVISOR account
 * @route   POST /api/classes
 * @access  ADMIN
 * **/

export const createClass = asyncHandler(async (req: Request, res: Response) => {
  const data = await classService.createClass(req.body as CreateClassInput);
  res.status(201).json({ success: true, data });
});

/**
 * @description Soft-delete a class by id
 * @route   DELETE /api/classes/:id
 * @access  ADMIN
 * **/

export const deleteClass = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as ClassIdParam;
  await classService.deleteClass(id);
  res.status(200).json({ success: true, data: { message: "Class deleted" } });
});
