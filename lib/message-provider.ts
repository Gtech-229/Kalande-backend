import logger from "./logger";
import { env } from "../config/env";
import { isWhatsAppReady, sendWhatsAppText } from "../config/whatsapp";

/**
 * Message provider seam.
 *
 * The messaging domain talks to THIS interface, never to a concrete WhatsApp
 * client. That keeps the queue/history/role logic free of whatsapp-web.js and
 * lets us swap the transport (log stub now, real WhatsApp later, or an official
 * API down the line) without touching the service.
 */

/**
 * Outcome of a single send attempt. The values match the terminal
 * MessageStatus enum members, so the service stores them directly.
 */
export type SendOutcome =
  | "SENT"
  | "FAILED_INVALID_NUMBER"
  | "FAILED_SESSION_CLOSED";

export type MessageProvider = {
  /**
   * Whether the provider can send right now (e.g. the WhatsApp session is
   * connected). The worker skips a pass when this is false, so PENDING rows are
   * retried later instead of being burned as failures.
   */
  isReady(): boolean;

  /**
   * Send one text message. Resolves with the outcome — it should NOT throw for
   * expected failures (invalid number, closed session); those are returned so
   * the worker can record them per message.
   */
  sendText(to: string, body: string): Promise<SendOutcome>;
};

/**
 * Log-only provider. Pretends every send succeeds and just logs it, so the full
 * pipeline (enqueue -> worker -> history) can run and be tested without a real
 * WhatsApp session or a QR scan. Replace `messageProvider` below with the real
 * whatsapp-web.js provider when wiring the actual integration.
 */
export const logMessageProvider: MessageProvider = {
  isReady() {
    return true;
  },

  async sendText(to: string, body: string): Promise<SendOutcome> {
    logger.info("WhatsApp message (stub provider)", { to, body });
    return "SENT";
  },
};

/**
 * Real WhatsApp provider (whatsapp-web.js). Delegates to config/whatsapp, which
 * owns the client and connection state.
 */
export const whatsappMessageProvider: MessageProvider = {
  isReady(): boolean {
    return isWhatsAppReady();
  },

  sendText(to: string, body: string): Promise<SendOutcome> {
    return sendWhatsAppText(to, body);
  },
};

/**
 * The provider the app uses: real WhatsApp when enabled (WHATSAPP_ENABLED=true),
 * else the log-only stub so dev/test run without a session. Single swap point.
 */
export const messageProvider: MessageProvider = env.WHATSAPP_ENABLED
  ? whatsappMessageProvider
  : logMessageProvider;
