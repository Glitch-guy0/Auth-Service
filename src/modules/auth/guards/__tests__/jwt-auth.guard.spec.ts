import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { ITokenService } from '@shared/lib/interfaces/token.interface';
import { TOKEN_SERVICE } from '@shared/lib/interfaces/token.token';
import { RedisService } from '../../../redis/redis.service';
import {
  TokenInvalidSignatureException,
  TokenExpiredException,
} from '@shared/exceptions/authentication.exception';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockTokenService: jest.Mocked<ITokenService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockRequest: Record<string, any>;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    mockTokenService = {
      generateTokenPair: jest.fn(),
      storeToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      findUserByRefreshToken: jest.fn(),
      deleteRefreshTokenByUserId: jest.fn(),
      blacklistToken: jest.fn(),
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as any;

    guard = new JwtAuthGuard(mockTokenService, mockRedisService);

    mockRequest = {};
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('valid token', () => {
    it('should return true for valid token with user attached', async () => {
      mockRequest.accessToken = 'valid-jwt-token';
      mockTokenService.verifyAccessToken.mockResolvedValue({ userId: 'user-123' });
      mockRedisService.get.mockResolvedValue(null);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({ userId: 'user-123' });
    });

    it('should verify the token via TokenService', async () => {
      mockRequest.accessToken = 'valid-jwt-token';
      mockTokenService.verifyAccessToken.mockResolvedValue({ userId: 'user-123' });
      mockRedisService.get.mockResolvedValue(null);

      await guard.canActivate(mockContext);

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('valid-jwt-token');
    });

    it('should check Redis blacklist after successful verification', async () => {
      mockRequest.accessToken = 'valid-jwt-token';
      mockTokenService.verifyAccessToken.mockResolvedValue({ userId: 'user-123' });
      mockRedisService.get.mockResolvedValue(null);

      await guard.canActivate(mockContext);

      expect(mockRedisService.get).toHaveBeenCalledWith('blacklist:valid-jwt-token');
    });
  });

  describe('missing token', () => {
    it('should throw UnauthorizedException when no token', async () => {
      mockRequest.accessToken = undefined;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow('Missing access token');
    });

    it('should throw UnauthorizedException when token is empty string', async () => {
      mockRequest.accessToken = '';

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is whitespace-only', async () => {
      mockRequest.accessToken = '   ';

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow('Missing access token');
    });
  });

  describe('invalid token', () => {
    it('should throw UnauthorizedException when token verification fails (invalid signature)', async () => {
      mockRequest.accessToken = 'invalid-token';
      mockTokenService.verifyAccessToken.mockRejectedValue(
        new TokenInvalidSignatureException('Invalid token signature'),
      );

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow('Invalid or expired token');
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      mockRequest.accessToken = 'expired-token';
      mockTokenService.verifyAccessToken.mockRejectedValue(
        new TokenExpiredException('Token has expired'),
      );

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow('Invalid or expired token');
    });

    it('should throw UnauthorizedException for unexpected verification errors', async () => {
      mockRequest.accessToken = 'some-token';
      mockTokenService.verifyAccessToken.mockRejectedValue(new Error('Database connection lost'));

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('blacklisted token', () => {
    it('should throw UnauthorizedException when token is blacklisted', async () => {
      mockRequest.accessToken = 'blacklisted-token';
      mockTokenService.verifyAccessToken.mockResolvedValue({ userId: 'user-123' });
      mockRedisService.get.mockResolvedValue('{"user_id":"user-123","expires_at":"2026-07-17T00:00:00Z"}');

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        expect.objectContaining({ message: 'Token has been revoked' }),
      );
    });

    it('should verify token before checking blacklist', async () => {
      mockRequest.accessToken = 'blacklisted-token';
      mockTokenService.verifyAccessToken.mockResolvedValue({ userId: 'user-123' });
      mockRedisService.get.mockResolvedValue('{"user_id":"user-123"}');

      const callOrder: string[] = [];
      mockTokenService.verifyAccessToken.mockImplementation(async (token) => {
        callOrder.push('verify');
        return { userId: 'user-123' };
      });
      mockRedisService.get.mockImplementation(async (key) => {
        callOrder.push('blacklist');
        return '{"user_id":"user-123"}';
      });

      await guard.canActivate(mockContext).catch(() => {});

      expect(callOrder).toEqual(['verify', 'blacklist']);
    });
  });

  describe('Redis failure handling', () => {
    it('should fail open when Redis connection fails', async () => {
      mockRequest.accessToken = 'valid-token';
      mockTokenService.verifyAccessToken.mockResolvedValue({ userId: 'user-123' });
      mockRedisService.get.mockRejectedValue(new Error('Redis connection refused'));

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({ userId: 'user-123' });
    });

    it('should fail open when Redis returns timeout error', async () => {
      mockRequest.accessToken = 'valid-token';
      mockTokenService.verifyAccessToken.mockResolvedValue({ userId: 'user-456' });
      mockRedisService.get.mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({ userId: 'user-456' });
    });
  });
});
