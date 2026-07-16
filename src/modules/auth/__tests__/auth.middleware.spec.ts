import { AuthMiddleware } from '../auth.middleware';
import type { AuthenticatedRequest } from '../auth.middleware';
import type { Request, Response, NextFunction } from 'express';

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new AuthMiddleware();
    mockRequest = { headers: {} };
    mockResponse = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should extract token from Bearer authorization header', () => {
    mockRequest.headers = { authorization: 'Bearer abc123' };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect((mockRequest as AuthenticatedRequest).accessToken).toBe('abc123');
  });

  it('should set accessToken to undefined when no Authorization header', () => {
    mockRequest.headers = {};

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect((mockRequest as AuthenticatedRequest).accessToken).toBeUndefined();
  });

  it('should set accessToken to undefined for non-Bearer scheme', () => {
    mockRequest.headers = { authorization: 'Basic abc123' };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect((mockRequest as AuthenticatedRequest).accessToken).toBeUndefined();
  });

  it('should not extract token when Bearer scheme lacks trailing space', () => {
    mockRequest.headers = { authorization: 'BearerToken123' };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect((mockRequest as AuthenticatedRequest).accessToken).toBeUndefined();
  });

  it('should set accessToken to empty string for empty Bearer token', () => {
    mockRequest.headers = { authorization: 'Bearer ' };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect((mockRequest as AuthenticatedRequest).accessToken).toBe('');
  });

  it('should always call next() exactly once', () => {
    mockRequest.headers = { authorization: 'Bearer abc123' };

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should call next() when no Authorization header is present', () => {
    mockRequest.headers = {};

    middleware.use(
      mockRequest as Request,
      mockResponse as Response,
      mockNext,
    );

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should not throw any exceptions for any input', () => {
    const testCases = [
      { headers: { authorization: 'Bearer token' } },
      { headers: {} },
      { headers: { authorization: 'Basic creds' } },
      { headers: { authorization: 'Bearer ' } },
      { headers: { authorization: 'ApiKey key123' } },
    ];

    for (const req of testCases) {
      expect(() => {
        middleware.use(req as any, mockResponse as Response, mockNext);
      }).not.toThrow();
    }
  });
});
