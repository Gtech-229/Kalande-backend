import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import * as userController from "../controllers/user.controller";
import {
  createUserSchema,
  listUsersQuerySchema,
  userIdParamSchema,
} from "../schemas/user.schema";

/**
 * User routes — wiring only: path + middleware stack + controller (CLAUDE.md).
 * Every endpoint is ADMIN-only: authenticate (valid token) then
 * authorize(ADMIN) (right role), before validate() on mutating routes.
 */
const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize(Role.ADMIN),
  validate(listUsersQuerySchema, "query"),
  userController.listUsers
);

router.post(
  "/",
  authorize(Role.ADMIN),
  validate(createUserSchema),
  userController.createUser
);

router.post(
  "/:id/resend-welcome",
  authorize(Role.ADMIN),
  validate(userIdParamSchema, "params"),
  userController.resendWelcomeEmail
);

export default router;
