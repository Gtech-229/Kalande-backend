/**
 * Pause for a number of milliseconds (pure, no DB).
 * Used by the message worker for the anti-spam delay between WhatsApp sends.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
