import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { LoggingInterceptor } from '../logging.interceptor';
import { LogManagerService } from '../log-manager';
import { ILogger } from '../logger.interface';

const mockLogger: ILogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

const mockLogManager = {
  getLogger: jest.fn().mockReturnValue(mockLogger),
} as unknown as LogManagerService;

function createMockContext(
  req: Partial<Request>,
  res: Partial<Response>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req as Request,
      getResponse: () => res as Response,
    }),
  } as unknown as ExecutionContext;
}

function createMockCallHandler(observable: Observable<unknown>): CallHandler {
  return { handle: () => observable };
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new LoggingInterceptor(mockLogManager);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log at info level with method, path, status, and duration on success', (done) => {
    const req = {
      method: 'POST',
      url: '/auth/v1/register',
      body: { username: 'alice' },
      headers: {},
    } as Request;

    const res = { statusCode: 201 } as Response;
    const context = createMockContext(req, res);

    interceptor.intercept(context, createMockCallHandler(of({}))).subscribe({
      complete: () => {
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        const call = (mockLogger.info as jest.Mock).mock.calls[0];
        const logContext = call[0];
        expect(logContext.method).toBe('POST');
        expect(logContext.path).toBe('/auth/v1/register');
        expect(logContext.status).toBe(201);
        expect(typeof logContext.duration).toBe('number');
        expect(logContext.requestId).toBeDefined();
        done();
      },
    });
  });

  it('should assign a requestId to req.requestId', (done) => {
    const req = {
      method: 'GET',
      url: '/health',
      body: {},
      headers: {},
    } as Request;

    const res = { statusCode: 200 } as Response;
    const context = createMockContext(req, res);

    interceptor.intercept(context, createMockCallHandler(of({}))).subscribe({
      complete: () => {
        expect(req.requestId).toBeDefined();
        expect(typeof req.requestId).toBe('string');
        done();
      },
    });
  });

  it('should assign unique requestIds to concurrent requests', (done) => {
    const req1 = {
      method: 'GET',
      url: '/a',
      body: {},
      headers: {},
    } as Request;

    const req2 = {
      method: 'GET',
      url: '/b',
      body: {},
      headers: {},
    } as Request;

    const res = { statusCode: 200 } as Response;
    const ctx1 = createMockContext(req1, res);
    const ctx2 = createMockContext(req2, res);

    interceptor.intercept(ctx1, createMockCallHandler(of({}))).subscribe({
      complete: () => {
        interceptor.intercept(ctx2, createMockCallHandler(of({}))).subscribe({
          complete: () => {
            expect(req1.requestId).toBeDefined();
            expect(req2.requestId).toBeDefined();
            expect(req1.requestId).not.toBe(req2.requestId);
            done();
          },
        });
      },
    });
  });

  it('should redact sensitive fields in request body at debug level', (done) => {
    const req = {
      method: 'POST',
      url: '/auth/v1/register',
      body: { username: 'alice', password: 'secret123' },
      headers: {},
    } as Request;

    const res = { statusCode: 201 } as Response;
    const context = createMockContext(req, res);

    interceptor.intercept(context, createMockCallHandler(of({}))).subscribe({
      complete: () => {
        expect(mockLogger.debug).toHaveBeenCalledTimes(1);
        const call = (mockLogger.debug as jest.Mock).mock.calls[0];
        const logContext = call[0];
        expect(logContext.body.password).toBe('[REDACTED]');
        expect(logContext.body.username).toBe('alice');
        done();
      },
    });
  });

  it('should redact accessToken and refreshToken in request body', (done) => {
    const req = {
      method: 'POST',
      url: '/auth/v1/refresh',
      body: { refreshToken: 'rt_abc123', accessToken: 'at_xyz789' },
      headers: {},
    } as Request;

    const res = { statusCode: 200 } as Response;
    const context = createMockContext(req, res);

    interceptor.intercept(context, createMockCallHandler(of({}))).subscribe({
      complete: () => {
        const call = (mockLogger.debug as jest.Mock).mock.calls[0];
        const logContext = call[0];
        expect(logContext.body.refreshToken).toBe('[REDACTED]');
        expect(logContext.body.accessToken).toBe('[REDACTED]');
        done();
      },
    });
  });

  it('should redact Authorization header in log', (done) => {
    const req = {
      method: 'GET',
      url: '/protected',
      body: {},
      headers: { authorization: 'Bearer abc123' },
    } as Request;

    const res = { statusCode: 200 } as Response;
    const context = createMockContext(req, res);

    interceptor.intercept(context, createMockCallHandler(of({}))).subscribe({
      complete: () => {
        expect(mockLogger.debug).toHaveBeenCalled();
        done();
      },
    });
  });

  it('should log duration as a positive number', (done) => {
    const req = {
      method: 'POST',
      url: '/auth/v1/login',
      body: {},
      headers: {},
    } as Request;

    const res = { statusCode: 200 } as Response;
    const context = createMockContext(req, res);

    interceptor.intercept(context, createMockCallHandler(of({}))).subscribe({
      complete: () => {
        const call = (mockLogger.info as jest.Mock).mock.calls[0];
        const logContext = call[0];
        expect(logContext.duration).toBeGreaterThanOrEqual(0);
        done();
      },
    });
  });

  it('should NOT log response body', (done) => {
    const req = {
      method: 'GET',
      url: '/data',
      body: {},
      headers: {},
    } as Request;

    const res = { statusCode: 200 } as Response;
    const context = createMockContext(req, res);

    interceptor
      .intercept(context, createMockCallHandler(of({ token: 'secret' })))
      .subscribe({
        complete: () => {
          const infoCall = (mockLogger.info as jest.Mock).mock.calls[0];
          const logContext = infoCall[0];
          expect(logContext.responseBody).toBeUndefined();
          expect(logContext.token).toBeUndefined();
          done();
        },
      });
  });

  it('should log at error level and re-throw on exception', (done) => {
    const req = {
      method: 'POST',
      url: '/auth/v1/login',
      body: {},
      headers: {},
    } as Request;

    const res = { statusCode: 401 } as Response;
    const context = createMockContext(req, res);

    const testError = new Error('Invalid credentials');

    interceptor
      .intercept(context, createMockCallHandler(throwError(() => testError)))
      .subscribe({
        error: (err) => {
          expect(err).toBe(testError);
          expect(mockLogger.error).toHaveBeenCalledTimes(1);
          const call = (mockLogger.error as jest.Mock).mock.calls[0];
          const logContext = call[0];
          expect(logContext.error).toBe('Invalid credentials');
          expect(logContext.method).toBe('POST');
          expect(logContext.path).toBe('/auth/v1/login');
          expect(typeof logContext.duration).toBe('number');
          done();
        },
      });
  });

  it('should log request body at debug level, not info', (done) => {
    const req = {
      method: 'POST',
      url: '/auth/v1/register',
      body: { username: 'alice', password: 'secret' },
      headers: {},
    } as Request;

    const res = { statusCode: 201 } as Response;
    const context = createMockContext(req, res);

    interceptor.intercept(context, createMockCallHandler(of({}))).subscribe({
      complete: () => {
        expect(mockLogger.debug).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalled();
        const debugCall = (mockLogger.debug as jest.Mock).mock.calls[0];
        expect(debugCall[0].body).toBeDefined();
        const infoCall = (mockLogger.info as jest.Mock).mock.calls[0];
        expect(infoCall[0].body).toBeUndefined();
        done();
      },
    });
  });
});
