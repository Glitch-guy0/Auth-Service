import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseAuthException } from './base.exception';

interface ErrorEnvelope {
  success: false;
  error: {
    code: number | string;
    message: string;
    timestamp: string;
    path: string;
    errors?: Array<{ path: (string | number)[]; message: string; code: string }>;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number | string = status;
    let message = 'Internal server error';
    let timestamp = new Date().toISOString();
    let errors: ErrorEnvelope['error']['errors'] | undefined;

    // Note: BaseAuthException and HttpException are separate hierarchies.
    // BaseAuthException extends Error; HttpException is NestJS's own class.
    // Order matters only if a class extends both (currently none do).
    if (exception instanceof BaseAuthException) {
      status = exception.statusCode;
      code = exception.errorCode;
      message = exception.message;
      timestamp = exception.timestamp;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status;
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const obj = res as Record<string, unknown>;
        message = (obj.message as string)?.toString() ?? exception.message;
        if (Array.isArray(obj.errors)) {
          errors = obj.errors as ErrorEnvelope['error']['errors'];
        }
      }
    } else {
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorEnvelope = {
      success: false,
      error: {
        code,
        message,
        timestamp,
        path: request.url,
        ...(errors && { errors }),
      },
    };

    response.status(status).json(body);
  }
}
