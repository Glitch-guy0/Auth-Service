import { BaseAuthException } from "./base.exception";

export class ValidationException extends BaseAuthException {
  readonly statusCode = 400;
  readonly errorCode = "VALIDATION_ERROR" as string;

  constructor(message: string) {
    super(message);
  }
}

export class UserExistsException extends ValidationException {
  readonly errorCode = "VALIDATION_USER_EXISTS";

  constructor(message = "User already exists with this email") {
    super(message);
  }
}
