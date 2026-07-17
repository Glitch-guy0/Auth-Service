/**
 * Abstract base class for all AuthService exceptions.
 *
 * Provides a consistent error structure with HTTP status code,
 * machine-readable error code, human-readable message, and ISO-8601
 * timestamp. All concrete exception classes extend this class.
 *
 * @abstract
 * @extends {Error}
 */
export abstract class BaseAuthException extends Error {
  /** HTTP status code to return in the response (e.g. 400, 401, 403) */
  abstract readonly statusCode: number;

  /** Machine-readable error code for client-side handling (e.g. "AUTH_INVALID_CREDENTIALS") */
  abstract readonly errorCode: string;

  /** ISO-8601 timestamp of when the exception was created */
  readonly timestamp: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Serialize the exception to a JSON-safe object for API responses.
   *
   * @returns Object containing statusCode, errorCode, message, and timestamp
   */
  toJSON() {
    return {
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      message: this.message,
      timestamp: this.timestamp,
    };
  }
}
