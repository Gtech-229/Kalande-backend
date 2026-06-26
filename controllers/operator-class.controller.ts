import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as operatorClassService from "../services/operator-class.service";
import type {
  OperatorParam,
  AssignClassInput,
  OperatorClassParam,
} from "../schemas/operator-class.schema";
import type { ClassIdParam } from "../schemas/class.schema";

/**
 * Operator-class controllers — thin handlers (CLAUDE.md).
 * They extract the already-validated input, call ONE service method, and send
 * the response. No business logic, no try/catch.
 *
 * req.params / req.body are cast to the validated input type: the validate()
 * middleware has already parsed them, so this narrows Express's built-in types.
 */

/**
 * @description List the classes an operator is authorized to enroll into
 * @route   GET /api/operators/:operatorId/classes
 * @access  ADMIN
 * **/

export const listOperatorClasses = asyncHandler(
  async (req: Request, res: Response) => {
    const { operatorId } = req.params as unknown as OperatorParam;
    const data = await operatorClassService.listOperatorClasses(operatorId);
    res.status(200).json({ success: true, data });
  }
);

/**
 * @description List operators that can still be assigned to a class
 * @route   GET /api/classes/:id/available-operators
 * @access  ADMIN
 * **/

export const listAvailableOperators = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as unknown as ClassIdParam;
    const data = await operatorClassService.listAvailableOperators(id);
    res.status(200).json({ success: true, data });
  }
);

/**
 * @description Authorize an operator to enroll students into a class
 * @route   POST /api/operators/:operatorId/classes
 * @access  ADMIN
 * **/

export const assignOperatorToClass = asyncHandler(
  async (req: Request, res: Response) => {
    const { operatorId } = req.params as unknown as OperatorParam;
    const { classId } = req.body as AssignClassInput;
    const data = await operatorClassService.assignOperatorToClass(
      operatorId,
      classId
    );
    res.status(201).json({ success: true, data });
  }
);

/**
 * @description Remove an operator's authorization for a class
 * @route   DELETE /api/operators/:operatorId/classes/:classId
 * @access  ADMIN
 * **/

export const removeOperatorFromClass = asyncHandler(
  async (req: Request, res: Response) => {
    const { operatorId, classId } = req.params as unknown as OperatorClassParam;
    await operatorClassService.removeOperatorFromClass(operatorId, classId);
    res
      .status(200)
      .json({ success: true, data: { message: "Authorization removed" } });
  }
);
