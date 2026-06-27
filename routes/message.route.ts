import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/auth";
import { authorize } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import * as messageController from "../controllers/message.controller";
import {
  sendMessageSchema,
  messageHistoryQuerySchema,
} from "../schemas/message.schema";

/**
 * Message routes — wiring only: path + middleware stack + controller (CLAUDE.md).
 * ADMIN and SUPERVISOR only (operators never message). The service further
 * limits a supervisor to their own class and reserves school-wide sends for
 * the admin.
 */
const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN, Role.SUPERVISOR));

router.post(
  "/send",
  validate(sendMessageSchema),
  messageController.sendMessage
);

router.get(
  "/history",
  validate(messageHistoryQuerySchema, "query"),
  messageController.getHistory
);

// Admin-only: drives the one-time QR pairing screen. The router-level authorize
// already allows ADMIN + SUPERVISOR; this narrows it to ADMIN.
router.get(
  "/whatsapp/status",
  authorize(Role.ADMIN),
  messageController.getWhatsAppStatus
);

// Admin-only: unlink the current account and emit a fresh QR (re-link / change
// the sending number) — drives the same QR screen as status.
router.post(
  "/whatsapp/logout",
  authorize(Role.ADMIN),
  messageController.logoutWhatsApp
);

export default router;
