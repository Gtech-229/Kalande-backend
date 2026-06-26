import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as messageService from "../services/message.service";
import type {
  SendMessageInput,
  MessageHistoryQuery,
} from "../schemas/message.schema";

/**
 * Message controllers — thin handlers (CLAUDE.md).
 * They extract the already-validated input, call ONE service method, and send
 * the response. No business logic, no try/catch.
 *
 * `actor` is built from req.user (set by authenticate); the service enforces
 * what each role may send and resolves recipients server-side.
 */

/**
 * @description Queue a WhatsApp message to a parent, a class, or the school
 * @route   POST /api/messages/send
 * @access  ADMIN, SUPERVISOR (supervisor: own class only; school is admin-only)
 * **/

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { userId, role } = req.user!;
  const data = await messageService.sendMessage(req.body as SendMessageInput, {
    userId,
    role,
  });
  // 202: accepted for delivery — the worker sends asynchronously.
  res.status(202).json({ success: true, data });
});

/**
 * @description List sent/queued messages
 * @route   GET /api/messages/history
 * @access  ADMIN (all), SUPERVISOR (own class only)
 * **/

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const { userId, role } = req.user!;
  const data = await messageService.getHistory(
    req.query as unknown as MessageHistoryQuery,
    { userId, role }
  );
  res.status(200).json({ success: true, data });
});

/**
 * @description WhatsApp connection status (+ QR to scan when linking)
 * @route   GET /api/messages/whatsapp/status
 * @access  ADMIN
 * **/

export const getWhatsAppStatus = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = messageService.whatsAppStatus();
    res.status(200).json({ success: true, data });
  }
);
