/**
 * AppError — an EXPECTED, operational error that the API knows how to answer.
 *
 * Use AppError when the failure is a normal part of the business flow and you
 * already know the HTTP status the client should get, e.g.:
 *   - 400 invalid input the schema could not catch
 *   - 401 missing/invalid token
 *   - 403 not allowed
 *   - 404 record not found
 *   - 409 conflict (e.g. email already registered)
 *
 * Use a plain `Error` (or just let it throw) for UNEXPECTED failures — bugs,
 * a database that is down, a null you did not anticipate. The error middleware
 * turns those into a generic 500 and logs them. Never use AppError to hide a
 * real bug behind a friendly status code.
 *
 * The error middleware reads `status`, `code`, and `fields` to build the
 * standard error response: { success: false, error: { message, code, fields? } }.
 */
export class AppError extends Error {
  /** HTTP status code to send (e.g. 401, 404). */
  public readonly status: number;

  /** Machine-readable error code (e.g. "INVALID_TOKEN"). */
  public readonly code: string;

  /** Optional per-field messages (used mainly for validation-style errors). */
  public readonly fields?: Record<string, string[]>;

  /** Marks this as an expected/operational error (vs an unexpected crash). */
  public readonly isOperational = true;

  constructor(
    status: number,
    code = "ERROR",
    message?: string,
    fields?: Record<string, string[]>
  ) {
    // Fall back to the code as the message if no human message is given.
    super(message ?? code);

    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;

    // Keep the prototype chain correct when targeting older JS runtimes.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
