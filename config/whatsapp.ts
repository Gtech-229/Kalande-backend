import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode";
import { env } from "./env";
import logger from "../lib/logger";
import type { SendOutcome } from "../lib/message-provider";

/**
 * WhatsApp client (external service, like config/database.ts).
 *
 * Wraps whatsapp-web.js — the ONLY file that imports it. Owns the connection
 * lifecycle (LocalAuth session on disk), the current QR for first-time linking,
 * the connection state, and the low-level send. The message provider talks to
 * this through isWhatsAppReady() / sendWhatsAppText().
 *
 * IMPORTANT: whatsapp-web.js runs a real headless Chromium and a single WhatsApp
 * Web session, so this must run on ONE persistent instance (never serverless,
 * never horizontally scaled).
 */

export type WhatsAppState =
  | "DISABLED" // WHATSAPP_ENABLED=false
  | "INITIALIZING" // launching Chromium / restoring session
  | "QR" // waiting for the admin to scan the QR
  | "CONNECTED" // ready to send
  | "DISCONNECTED"; // session dropped / auth failed

let state: WhatsAppState = env.WHATSAPP_ENABLED ? "INITIALIZING" : "DISABLED";
let currentQr: string | null = null; // data URL, set only while state is "QR"
let client: Client | null = null;

/** Current connection state plus the QR (data URL) when one needs scanning. */
export function getWhatsAppStatus(): {
  state: WhatsAppState;
  qr: string | null;
} {
  return { state, qr: currentQr };
}

/** Whether the client can send right now. Read by the message worker. */
export function isWhatsAppReady(): boolean {
  return state === "CONNECTED";
}

/** Phone like "+225 07 00 00 00 00" -> "2250700000000" (digits only). */
function toDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Initialize the client (no-op when disabled). Wires the lifecycle events and
 * starts Chromium. Resolves once initialization kicks off; actual readiness is
 * signalled later by the "ready" event.
 */
export async function initWhatsApp(): Promise<void> {
  if (!env.WHATSAPP_ENABLED) {
    logger.info("WhatsApp disabled — message provider uses the log-only stub");
    return;
  }

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: env.WHATSAPP_SESSION_PATH }),
    puppeteer: {
      // --no-sandbox is required to run Chromium as a service user / in a VM.
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      // Undefined -> Puppeteer's bundled Chromium; set to use a system one.
      executablePath: env.PUPPETEER_EXECUTABLE_PATH,
    },
  });

  client.on("qr", (qr) => {
    state = "QR";
    // Store a data-URL for the admin status endpoint (UI scanning).
    qrcode
      .toDataURL(qr)
      .then((url) => {
        currentQr = url;
      })
      .catch((error) => {
        logger.error("Failed to render WhatsApp QR", { error });
      });
    // Also print a scannable QR to stdout — handy for first-time linking when
    // running the app in the foreground over SSH. Best-effort.
    qrcode
      .toString(qr, { type: "terminal", small: true })
      .then((ascii) => process.stdout.write(`\n${ascii}\n`))
      .catch(() => {
        /* terminal QR is optional */
      });
    logger.info(
      "WhatsApp QR ready — scan the terminal QR, or via GET /api/messages/whatsapp/status"
    );
  });

  client.on("ready", () => {
    state = "CONNECTED";
    currentQr = null;
    logger.info("WhatsApp connected");
  });

  client.on("authenticated", () => {
    logger.info("WhatsApp authenticated");
  });

  client.on("auth_failure", (message) => {
    state = "DISCONNECTED";
    currentQr = null;
    logger.error("WhatsApp auth failure", { message });
  });

  client.on("disconnected", (reason) => {
    state = "DISCONNECTED";
    currentQr = null;
    logger.warn("WhatsApp disconnected", { reason });
  });

  await client.initialize();
}

/** Tear down the client on shutdown. */
export async function destroyWhatsApp(): Promise<void> {
  if (client) {
    await client.destroy();
    client = null;
    state = env.WHATSAPP_ENABLED ? "INITIALIZING" : "DISABLED";
  }
}

/**
 * Send one text message. Never throws — returns the outcome so the worker can
 * record it per message:
 * - not connected      -> FAILED_SESSION_CLOSED (left PENDING-able / retried)
 * - number not on WA   -> FAILED_INVALID_NUMBER
 * - sent               -> SENT
 */
export async function sendWhatsAppText(
  to: string,
  body: string
): Promise<SendOutcome> {
  if (!client || state !== "CONNECTED") {
    return "FAILED_SESSION_CLOSED";
  }

  try {
    const numberId = await client.getNumberId(toDigits(to));
    if (!numberId) {
      return "FAILED_INVALID_NUMBER";
    }

    await client.sendMessage(numberId._serialized, body);
    return "SENT";
  } catch (error) {
    logger.error("WhatsApp send failed", { error });
    return "FAILED_SESSION_CLOSED";
  }
}
