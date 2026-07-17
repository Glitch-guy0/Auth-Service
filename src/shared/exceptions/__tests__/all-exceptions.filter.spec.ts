import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exceptions.filter';
import { BaseAuthException } from '../base.exception';
import { InvalidCredentialsException, TokenExpiredException } from '../authentication.exception';
import { UserBlockedException } from '../authorization.exception';
import { UserExistsException } from '../validation.exception';

class ConcreteAuthException extends BaseAuthException {
  readonly statusCode = 418;
  readonly errorCode = 'TEST_ERROR';

  constructor(message = 'Test error') {
    super(message);
  }
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: {
    url: string;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = {
      url: '/auth/v1/authenticate',
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BaseAuthException handling', () => {
    it('should catch BaseAuthException subclass with correct status, code, and message', () => {
      const exception = new InvalidCredentialsException('Invalid email or password');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          path: '/auth/v1/authenticate',
        },
      });
    });

    it('should catch UserBlockedException with 403 status', () => {
      const exception = new UserBlockedException();

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_USER_BLOCKED',
          message: 'User account has been blocked',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          path: '/auth/v1/authenticate',
        },
      });
    });

    it('should catch TokenExpiredException with 401 status and TOKEN_EXPIRED code', () => {
      const exception = new TokenExpiredException('Token has expired');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          path: '/auth/v1/authenticate',
        },
      });
    });

    it('should catch UserExistsException with 400 status', () => {
      const exception = new UserExistsException();

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_USER_EXISTS',
          message: 'User already exists with this email',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          path: '/auth/v1/authenticate',
        },
      });
    });

    it('should catch concrete BaseAuthException with custom status and code', () => {
      const exception = new ConcreteAuthException('Custom test error');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(418);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Custom test error',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          path: '/auth/v1/authenticate',
        },
      });
    });

    it('should use exception.timestamp for BaseAuthException', () => {
      const exception = new InvalidCredentialsException('Invalid credentials');
      const exceptionTimestamp = exception.timestamp;

      filter.catch(exception, mockHost);

      const body = mockResponse.json.mock.calls[0][0];
      expect(body.error.timestamp).toBe(exceptionTimestamp);
    });
  });

  describe('HttpException handling', () => {
    it('should catch NestJS HttpException with correct status and message', () => {
      const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 400,
          message: 'Bad request',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          path: '/auth/v1/authenticate',
        },
      });
    });

    it('should extract message from HttpException object response', () => {
      const exception = new HttpException(
        { message: 'Validation failed', statusCode: 422 },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 422,
          message: 'Validation failed',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          path: '/auth/v1/authenticate',
        },
      });
    });

    it('should fallback to exception.message when response has no message field', () => {
      const exception = new HttpException(
        { statusCode: 503 },
        HttpStatus.SERVICE_UNAVAILABLE,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: exception.message,
          }),
        }),
      );
    });

    it('should handle HttpException with message as string[]', () => {
      const exception = new HttpException(
        { message: ['email must be an email', 'password is too short'], statusCode: 400 },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 400,
            message: 'email must be an email,password is too short',
          }),
        }),
      );
    });

    it('should propagate errors array from HttpException (Zod-style validation)', () => {
      const exception = new HttpException(
        {
          message: 'Validation failed',
          errors: [
            { path: ['email'], message: 'Invalid email', code: 'invalid_type' },
            { path: ['password'], message: 'Too short', code: 'too_short' },
          ],
          statusCode: 422,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 422,
            message: 'Validation failed',
            errors: [
              { path: ['email'], message: 'Invalid email', code: 'invalid_type' },
              { path: ['password'], message: 'Too short', code: 'too_short' },
            ],
          }),
        }),
      );
    });
  });

  describe('Unknown exception handling', () => {
    it('should return 500 with generic message for unknown exceptions', () => {
      const exception = new Error('Something went wrong');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 500,
          message: 'Internal server error',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          path: '/auth/v1/authenticate',
        },
      });
    });

    it('should handle non-Error unknown exceptions', () => {
      const exception = 'string error';

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 500,
            message: 'Internal server error',
          }),
        }),
      );
    });
  });

  describe('Response envelope', () => {
    it('should always return success: false', () => {
      filter.catch(new HttpException('test', 400), mockHost);

      const body = mockResponse.json.mock.calls[0][0];
      expect(body.success).toBe(false);
    });

    it('should include ISO 8601 timestamp', () => {
      filter.catch(new HttpException('test', 400), mockHost);

      const body = mockResponse.json.mock.calls[0][0];
      const timestamp = body.error.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should include request path', () => {
      mockRequest.url = '/auth/v1/register';
      filter.catch(new HttpException('test', 400), mockHost);

      const body = mockResponse.json.mock.calls[0][0];
      expect(body.error.path).toBe('/auth/v1/register');
    });

    it('should not include stack traces', () => {
      filter.catch(new Error('secret internal details'), mockHost);

      const body = mockResponse.json.mock.calls[0][0];
      expect(body.error).not.toHaveProperty('stack');
      expect(JSON.stringify(body)).not.toContain('secret internal details');
    });
  });
});
