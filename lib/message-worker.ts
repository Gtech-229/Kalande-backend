import logger from "./logger";
import { sleep } from "../utils/sleep";
import { deliverNextBatch } from "../services/message.service";
import { MESSAGE_WORKER_POLL_MS } from "../constants/message";

/**
 * Background message worker.
 *
 * A single in-process loop that drains PENDING message_history rows via
 * deliverNextBatch(). It runs continuously while there is a backlog (each batch
 * already paces itself for anti-spam) and idles for MESSAGE_WORKER_POLL_MS when
 * the queue is empty.
 *
 * IMPORTANT: this assumes ONE running instance — whatsapp-web.js owns a single
 * session, so the app must not be horizontally scaled without a dedicated
 * single worker. Started once from server.ts.
 */
let running = false;

export function startMessageWorker(): void {
  if (running) {
    return;
  }
  running = true;
  logger.info("Message worker started");
  void loop();
}

/** Stop the loop after the current batch (used on graceful shutdown). */
export function stopMessageWorker(): void {
  running = false;
}

async function loop(): Promise<void> {
  while (running) {
    try {
      const processed = await deliverNextBatch();
      // Nothing to do -> idle. Otherwise keep draining the backlog.
      if (processed === 0) {
        await sleep(MESSAGE_WORKER_POLL_MS);
      }
    } catch (error) {
      // Never let a single failure kill the loop; log and back off.
      logger.error("Message worker batch failed", { error });
      await sleep(MESSAGE_WORKER_POLL_MS);
    }
  }
}
