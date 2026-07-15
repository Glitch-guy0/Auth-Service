import { BaseAuthException } from "./base.exception";

export class AuthenticationException extends BaseAuthException {
  readonly statusCode = 401;
  readonly errorCode = "AUTH_ERROR" as string;

  constructor(message: string) {
    super(message);
  }
}

export class InvalidCredentialsException extends AuthenticationException {
  readonly errorCode = "AUTH_INVALID_CREDENTIALS";

  constructor(message = "Invalid email or password") {
    super(message);
  }
}

export class TokenExpiredException extends AuthenticationException {
  readonly errorCode = "TOKEN_EXPIRED";

  constructor(message = "Token has expired") {
    super(message);
  }
}

export class TokenRevokedException extends AuthenticationException {
  readonly errorCode = "TOKEN_REVOKED";

  constructor(message = "Token has been revoked") {
    super(message);
  }
}

export class TokenInvalidSignatureException extends AuthenticationException {
  readonly errorCode = "TOKEN_INVALID_SIGNATURE";

  constructor(message = "Token signature is invalid") {
    super(message);
  }
}
