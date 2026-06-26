/**
 * Date helpers (pure, no DB).
 */

/**
 * Strip the time portion of a date, keeping only the calendar day at UTC
 * midnight. Used for attendance, which is stored in a DATE column (no time):
 * normalizing both the value we write and the value we query by guarantees a
 * given day always compares equal, regardless of the original time.
 */
export function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/**
 * Format a date as dd/mm/yyyy, the convention used in the parent-facing French
 * WhatsApp messages. Reads the UTC parts so it matches the stored DATE value.
 */
export function formatDateFr(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
