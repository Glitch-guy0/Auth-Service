import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LogManagerService } from './log-manager';
import { ILogger } from './logger.interface';

const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'authorization',
  'authorizationheader',
  'accesstoken',
  'refreshtoken',
]);

function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const cloned = { ...(body as Record<string, unknown>) };

  for (const key of Object.keys(cloned)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      cloned[key] = '[REDACTED]';
    }
  }

  return cloned;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger: ILogger;

  constructor(private readonly logManager: LogManagerService) {
    this.logger = this.logManager.getLogger('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (!req.requestId) {
      req.requestId = uuidv4();
    }

    const requestId = req.requestId;
    const { method, url } = req;
    const startTime = Date.now();

    const redactedBody = redactBody(req.body);
    this.logger.debug(
      { requestId, method, path: url, body: redactedBody },
      'Incoming request',
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.info(
          { requestId, method, path: url, status: res.statusCode, duration },
          `${method} ${url} ${res.statusCode} ${duration}ms`,
        );
      }),
      catchError((error: Error) => {
        const duration = Date.now() - startTime;
        const status = res.statusCode || 500;
        this.logger.error(
          {
            requestId,
            method,
            path: url,
            status,
            duration,
            error: error.message,
          },
          `${method} ${url} ${status} ${duration}ms - ${error.message}`,
        );
        throw error;
      }),
    );
  }
}
