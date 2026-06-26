import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import * as dashboardController from "../controllers/dashboard.controller";

/**
 * Dashboard routes — wiring only: path + middleware stack + controller
 * (CLAUDE.md). Read-only, so no validate(). Each endpoint is gated to its own
 * role: the admin sees the whole school, a supervisor sees only their class.
 */
const router = Router();

router.use(authenticate);

router.get(
  "/admin",
  authorize(Role.ADMIN),
  dashboardController.getAdminDashboard
);

router.get(
  "/supervisor",
  authorize(Role.SUPERVISOR),
  dashboardController.getSupervisorDashboard
);

export default router;
