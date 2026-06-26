import app from "./app";
import { env } from "./config/env";
import { db } from "./config/database";
import logger from "./lib/logger";
import { startMessageWorker, stopMessageWorker } from "./lib/message-worker";
import { verifyEmailTransport } from "./config/email";
import { initWhatsApp, destroyWhatsApp } from "./config/whatsapp";

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT} (${env.NODE_ENV})`);
  // Check SMTP connectivity (logs only — never blocks boot).
  void verifyEmailTransport();
  // Launch the WhatsApp client if enabled (no-op otherwise). Failures are logged
  // inside; never block boot.
  void initWhatsApp().catch((error) => {
    logger.error("WhatsApp initialization failed", { error });
  });
  // Start draining the WhatsApp message queue in the background.
  startMessageWorker();
});

/**
 * Graceful shutdown.
 *
 * 1. Stop accepting new connections (server.close).
 * 2. Disconnect Prisma so the DB pool is released cleanly.
 * 3. Log and exit.
 *
 * Triggered by SIGTERM (orchestrators) and SIGINT (Ctrl+C).
 */
function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop the message worker loop so no new batch starts during shutdown.
  stopMessageWorker();

  // Tear down the WhatsApp client (closes Chromium). Best-effort.
  void destroyWhatsApp().catch((error) => {
    logger.error("Error tearing down WhatsApp", { error });
  });

  server.close(() => {
    db.$disconnect()
      .then(() => {
        logger.info("Shutdown complete");
        process.exit(0);
      })
      .catch((error : string) => {
        logger.error("Error during shutdown", { error });
        process.exit(1);
      });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
