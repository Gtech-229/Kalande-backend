import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import * as classController from "../controllers/class.controller";
// Class-scoped read that lives in the operator-class domain (it queries the
// operator_classes pivot), but is exposed here under /classes/:id/... .
import * as operatorClassController from "../controllers/operator-class.controller";
import {
  createClassSchema,
  classIdParamSchema,
} from "../schemas/class.schema";

/**
 * Class routes — wiring only: path + middleware stack + controller (CLAUDE.md).
 * Every endpoint is ADMIN-only: authenticate (valid token) then
 * authorize(ADMIN) (right role), before validate() on mutating routes.
 */
const router = Router();

router.use(authenticate)

router.get("/",  authorize(Role.ADMIN), classController.listClasses);

router.get(
  "/:id/available-operators",
  authorize(Role.ADMIN),
  validate(classIdParamSchema, "params"),
  operatorClassController.listAvailableOperators
);

router.post(
  "/",
  authorize(Role.ADMIN),
  validate(createClassSchema),
  classController.createClass
);

router.delete(
  "/:id",
  authorize(Role.ADMIN),
  validate(classIdParamSchema, "params"),
  classController.deleteClass
);

export default router;
