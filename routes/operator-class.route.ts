import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import * as operatorClassController from "../controllers/operator-class.controller";
import {
  operatorParamSchema,
  assignClassSchema,
  operatorClassParamSchema,
} from "../schemas/operator-class.schema";

/**
 * Operator-class routes — wiring only: path + middleware stack + controller
 * (CLAUDE.md). Every endpoint is ADMIN-only: only the admin decides which
 * classes an operator may enroll students into.
 *
 * Mounted at /operators, so paths are operator-centric:
 *   GET    /operators/:operatorId/classes
 *   POST   /operators/:operatorId/classes
 *   DELETE /operators/:operatorId/classes/:classId
 */
const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN));

router.get(
  "/:operatorId/classes",
  validate(operatorParamSchema, "params"),
  operatorClassController.listOperatorClasses
);

router.post(
  "/:operatorId/classes",
  validate(operatorParamSchema, "params"),
  validate(assignClassSchema),
  operatorClassController.assignOperatorToClass
);

router.delete(
  "/:operatorId/classes/:classId",
  validate(operatorClassParamSchema, "params"),
  operatorClassController.removeOperatorFromClass
);

export default router;
