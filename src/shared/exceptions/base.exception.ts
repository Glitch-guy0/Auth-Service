export abstract class BaseAuthException extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;

  readonly timestamp: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      message: this.message,
      timestamp: this.timestamp,
    };
  }
}
