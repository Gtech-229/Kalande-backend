import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as dashboardService from "../services/dashboard.service";

/**
 * Dashboard controllers — thin handlers (CLAUDE.md).
 * Read-only: no request input to validate. The supervisor's class is resolved
 * inside the service from req.user, so we only pass the user id.
 */

/**
 * @description Whole-school stats (classes, students, staff, today's call)
 * @route   GET /api/dashboard/admin
 * @access  ADMIN
 * **/

export const getAdminDashboard = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await dashboardService.getAdminDashboard();
    res.status(200).json({ success: true, data });
  }
);

/**
 * @description Supervisor's class stats and today's call status
 * @route   GET /api/dashboard/supervisor
 * @access  SUPERVISOR
 * **/

export const getSupervisorDashboard = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await dashboardService.getSupervisorDashboard({
      userId: req.user!.userId,
    });
    res.status(200).json({ success: true, data });
  }
);
