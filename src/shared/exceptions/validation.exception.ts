import { BaseAuthException } from "./base.exception";

/**
 * General validation error (HTTP 400).
 *
 * Base class for specific validation failures such as duplicate users.
 *
 * @extends {BaseAuthException}
 */
export class ValidationException extends BaseAuthException {
  readonly statusCode = 400;
  readonly errorCode = "VALIDATION_ERROR" as string;

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when a registration attempt uses a username or email that already exists.
 *
 * @extends {ValidationException}
 */
export class UserExistsException extends ValidationException {
  readonly errorCode = "VALIDATION_USER_EXISTS";

  constructor(message = "User already exists with this email") {
    super(message);
  }
}
