import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import * as studentController from "../controllers/student.controller";
import {
  createStudentSchema,
  updateStudentSchema,
  studentIdParamSchema,
  listStudentsQuerySchema,
} from "../schemas/student.schema";

/**
 * Student routes — wiring only: path + middleware stack + controller (CLAUDE.md).
 * Restricted to ADMIN and OPERATOR (APP_CONTEXT.md). The service further limits
 * an OPERATOR to the classes they are authorized for.
 */
const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN, Role.OPERATOR));

router.get(
  "/",
  validate(listStudentsQuerySchema, "query"),
  studentController.listStudents
);

router.post(
  "/",
  validate(createStudentSchema),
  studentController.createStudent
);

router.put(
  "/:id",
  validate(studentIdParamSchema, "params"),
  validate(updateStudentSchema),
  studentController.updateStudent
);

export default router;
