import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorEnvelope {
  success: false;
  error: {
    code: number;
    message: string;
    timestamp: string;
    path: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message?.toString() ??
            exception.message;
    }

    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(body);
  }
}
