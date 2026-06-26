import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import * as attendanceController from "../controllers/attendance.controller";
import {
  submitAttendanceSchema,
  attendanceHistoryQuerySchema,
} from "../schemas/attendance.schema";

/**
 * Attendance routes — wiring only: path + middleware stack + controller
 * (CLAUDE.md). SUPERVISOR-only: the call is the supervisor's job, and each one
 * acts only on the class they run (resolved server-side in the service).
 */
const router = Router();

router.use(authenticate);
router.use(authorize(Role.SUPERVISOR));

router.get("/students", attendanceController.listCallListStudents);

router.post(
  "/submit",
  validate(submitAttendanceSchema),
  attendanceController.submitAttendance
);

router.get(
  "/history",
  validate(attendanceHistoryQuerySchema, "query"),
  attendanceController.getAttendanceHistory
);

export default router;
