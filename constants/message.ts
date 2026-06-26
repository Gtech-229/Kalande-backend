/**
 * WhatsApp messaging constants.
 * Keep magic numbers out of the worker/service (CLAUDE.md).
 */

/**
 * Anti-spam pacing: a random pause between MIN and MAX is taken AFTER each
 * message so WhatsApp does not flag the number for bursting (APP_CONTEXT.md).
 */
export const MESSAGE_DELAY_MIN_MS = 3000;
export const MESSAGE_DELAY_MAX_MS = 8000;

/** How many PENDING messages a single worker pass handles. */
export const MESSAGE_BATCH_SIZE = 10;

/** How long the worker idles when there is nothing left to send. */
export const MESSAGE_WORKER_POLL_MS = 5000;
