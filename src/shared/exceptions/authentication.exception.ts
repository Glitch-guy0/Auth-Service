import { BaseAuthException } from "./base.exception";

/**
 * General authentication error (HTTP 401).
 *
 * Base class for specific authentication failures such as invalid credentials,
 * expired tokens, and revoked tokens.
 *
 * @extends {BaseAuthException}
 */
export class AuthenticationException extends BaseAuthException {
  readonly statusCode = 401;
  readonly errorCode = "AUTH_ERROR" as string;

  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when the provided username/email or password is incorrect.
 *
 * @extends {AuthenticationException}
 */
export class InvalidCredentialsException extends AuthenticationException {
  readonly errorCode = "AUTH_INVALID_CREDENTIALS";

  constructor(message = "Invalid email or password") {
    super(message);
  }
}

/**
 * Thrown when a JWT (access or refresh) has passed its expiration time.
 *
 * @extends {AuthenticationException}
 */
export class TokenExpiredException extends AuthenticationException {
  readonly errorCode = "TOKEN_EXPIRED";

  constructor(message = "Token has expired") {
    super(message);
  }
}

/**
 * Thrown when a JWT has been revoked (e.g. via logout blacklisting).
 *
 * @extends {AuthenticationException}
 */
export class TokenRevokedException extends AuthenticationException {
  readonly errorCode = "TOKEN_REVOKED";

  constructor(message = "Token has been revoked") {
    super(message);
  }
}

/**
 * Thrown when a JWT signature verification fails.
 *
 * Covers malformed tokens, missing kid, unknown public key,
 * and RSA signature mismatch scenarios.
 *
 * @extends {AuthenticationException}
 */
export class TokenInvalidSignatureException extends AuthenticationException {
  readonly errorCode = "TOKEN_INVALID_SIGNATURE";

  constructor(message = "Token signature is invalid") {
    super(message);
  }
}
