import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as attendanceService from "../services/attendance.service";
import type {
  SubmitAttendanceInput,
  AttendanceHistoryQuery,
} from "../schemas/attendance.schema";

/**
 * Attendance controllers — thin handlers (CLAUDE.md).
 * They extract the already-validated input, call ONE service method, and send
 * the response. No business logic, no try/catch.
 *
 * `actor` is built from req.user (set by authenticate). The supervisor's class
 * is resolved inside the service, so we only pass the user id.
 */

/**
 * @description List the active students of the supervisor's class (call list)
 * @route   GET /api/attendance/students
 * @access  SUPERVISOR
 * **/

export const listCallListStudents = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await attendanceService.listCallListStudents({
      userId: req.user!.userId,
    });
    res.status(200).json({ success: true, data });
  }
);

/**
 * @description Validate the call for the supervisor's class (triggers WhatsApp)
 * @route   POST /api/attendance/submit
 * @access  SUPERVISOR
 * **/

export const submitAttendance = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await attendanceService.submitAttendance(
      req.body as SubmitAttendanceInput,
      { userId: req.user!.userId }
    );
    res.status(201).json({ success: true, data });
  }
);

/**
 * @description Attendance history of the supervisor's class
 * @route   GET /api/attendance/history
 * @access  SUPERVISOR
 * **/

export const getAttendanceHistory = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await attendanceService.getAttendanceHistory(
      req.query as unknown as AttendanceHistoryQuery,
      { userId: req.user!.userId }
    );
    res.status(200).json({ success: true, data });
  }
);
