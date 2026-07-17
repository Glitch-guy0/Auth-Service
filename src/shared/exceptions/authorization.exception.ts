import { BaseAuthException } from "./base.exception";

/**
 * General authorization error (HTTP 403).
 *
 * Base class for specific authorization failures such as blocked accounts.
 *
 * @extends {BaseAuthException}
 */
export class AuthorizationException extends BaseAuthException {
  readonly statusCode = 403;
  readonly errorCode = "AUTH_FORBIDDEN" as string;

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when a blocked user attempts to authenticate.
 *
 * @extends {AuthorizationException}
 */
export class UserBlockedException extends AuthorizationException {
  readonly errorCode = "AUTH_USER_BLOCKED";

  constructor(message = "User account has been blocked") {
    super(message);
  }
}
