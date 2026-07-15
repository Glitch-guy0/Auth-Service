import { BaseAuthException } from "./base.exception";

export class AuthorizationException extends BaseAuthException {
  readonly statusCode = 403;
  readonly errorCode = "AUTH_FORBIDDEN" as string;

  constructor(message: string) {
    super(message);
  }
}

export class UserBlockedException extends AuthorizationException {
  readonly errorCode = "AUTH_USER_BLOCKED";

  constructor(message = "User account has been blocked") {
    super(message);
  }
}
