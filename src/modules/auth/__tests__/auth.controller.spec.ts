import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegisterDto, RegisterSchema } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { UserExistsException } from '../../../shared/exceptions/validation.exception';
import {
  InvalidCredentialsException,
  TokenExpiredException,
  AuthenticationException,
} from '../../../shared/exceptions/authentication.exception';
import { UserBlockedException } from '../../../shared/exceptions/authorization.exception';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };

  const mockRequest = { ip: '192.168.1.1', headers: {} } as any;
  const mockResponse = { cookie: jest.fn() } as any;

  const validDto: RegisterDto = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
  };

  const loginDto: LoginDto = {
    usernameOrEmail: 'test@example.com',
    password: 'password123',
  };

  const mockTokens = {
    accessToken: 'access-token-value',
    refreshToken: 'refresh-token-value',
    expiresIn: 3600,
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue(mockTokens),
      login: jest.fn().mockResolvedValue(mockTokens),
      refresh: jest.fn().mockResolvedValue(mockTokens),
      logout: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should return 201 with tokens on valid registration', async () => {
      const result = await controller.register(validDto, mockRequest, mockResponse);

      expect(result).toEqual(mockTokens);
      expect(authService.register).toHaveBeenCalledWith(
        validDto,
        '192.168.1.1',
      );
    });

    it('should return TokenResponseDto from AuthService.register', async () => {
      const result = await controller.register(validDto, mockRequest, mockResponse);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should throw UserExistsException when user already exists', async () => {
      authService.register.mockRejectedValue(
        new UserExistsException('User already exists with this username'),
      );

      await expect(controller.register(validDto, mockRequest, mockResponse)).rejects.toThrow(
        UserExistsException,
      );
    });

    it('should propagate unknown errors directly to filter', async () => {
      const error = new Error('Unexpected error');
      authService.register.mockRejectedValue(error);

      await expect(controller.register(validDto, mockRequest, mockResponse)).rejects.toThrow(
        Error,
      );
    });
  });

  describe('ZodValidationPipe', () => {
    it('should reject invalid input before reaching the controller', async () => {
      const pipe = new ZodValidationPipe(RegisterSchema);

      expect(() => pipe.transform({})).toThrow(BadRequestException);
      expect(() =>
        pipe.transform({ username: 'ab', email: 'bad', password: 'short' }),
      ).toThrow(BadRequestException);
    });

    it('should accept valid input', () => {
      const pipe = new ZodValidationPipe(RegisterSchema);
      const result = pipe.transform(validDto);

      expect(result).toEqual(validDto);
    });
  });

  describe('login', () => {
    it('should return 200 with tokens on valid login', async () => {
      const result = await controller.login(loginDto, mockRequest, mockResponse);

      expect(result).toEqual(mockTokens);
      expect(authService.login).toHaveBeenCalledWith(loginDto, '192.168.1.1');
    });

    it('should return TokenResponseDto from AuthService.login', async () => {
      const result = await controller.login(loginDto, mockRequest, mockResponse);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should throw InvalidCredentialsException for invalid credentials', async () => {
      authService.login.mockRejectedValue(
        new InvalidCredentialsException('Invalid email or password'),
      );

      await expect(controller.login(loginDto, mockRequest, mockResponse)).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('should throw UserBlockedException for blocked user', async () => {
      authService.login.mockRejectedValue(
        new UserBlockedException('User account has been blocked'),
      );

      await expect(controller.login(loginDto, mockRequest, mockResponse)).rejects.toThrow(
        UserBlockedException,
      );
    });

    it('should propagate unknown errors directly to filter', async () => {
      const error = new Error('Unexpected error');
      authService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto, mockRequest, mockResponse)).rejects.toThrow(
        Error,
      );
    });
  });

  describe('refresh', () => {
    let mockResponse: { cookie: jest.Mock };
    let mockRequest: { cookies: { refreshToken: string } };

    beforeEach(() => {
      mockResponse = { cookie: jest.fn() };
      mockRequest = { cookies: { refreshToken: 'valid-refresh-token' } };
    });

    it('should return 200 with new tokens on valid refresh', async () => {
      const result = await controller.refresh(
        mockRequest as any,
        mockResponse as any,
      );

      expect(result).toEqual(mockTokens);
      expect(authService.refresh).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token-value',
        expect.objectContaining({ httpOnly: true, path: '/auth' }),
      );
    });

    it('should throw TokenExpiredException for expired token', async () => {
      authService.refresh.mockRejectedValue(
        new TokenExpiredException('Refresh token has expired'),
      );
      mockRequest.cookies.refreshToken = 'expired-token';

      await expect(
        controller.refresh(mockRequest as any, mockResponse as any),
      ).rejects.toThrow(TokenExpiredException);
    });

    it('should throw InvalidCredentialsException for invalid credentials', async () => {
      authService.refresh.mockRejectedValue(
        new InvalidCredentialsException('Invalid refresh token'),
      );
      mockRequest.cookies.refreshToken = 'invalid-token';

      await expect(
        controller.refresh(mockRequest as any, mockResponse as any),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('should propagate unknown errors directly to filter', async () => {
      authService.refresh.mockRejectedValue(new Error('Unexpected'));

      await expect(
        controller.refresh(mockRequest as any, mockResponse as any),
      ).rejects.toThrow(Error);
    });
  });

  describe('logout', () => {
    it('should return 200 with { success: true, data: null } on valid logout', async () => {
      const mockResponse = { clearCookie: jest.fn() };

      const result = await controller.logout(
        'Bearer valid-token',
        mockResponse as any,
      );

      expect(result).toBeNull();
      expect(authService.logout).toHaveBeenCalledWith('valid-token');
    });

    it('should clear refresh token cookie', async () => {
      const mockResponse = { clearCookie: jest.fn() };

      await controller.logout('Bearer valid-token', mockResponse as any);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/auth',
      });
    });

    it('should throw AuthenticationException when Authorization header is missing', async () => {
      const mockResponse = { clearCookie: jest.fn() };

      await expect(
        controller.logout(undefined as any, mockResponse as any),
      ).rejects.toThrow(AuthenticationException);
    });

    it('should throw AuthenticationException for malformed header (no Bearer prefix)', async () => {
      const mockResponse = { clearCookie: jest.fn() };

      await expect(
        controller.logout('invalid-header', mockResponse as any),
      ).rejects.toThrow(AuthenticationException);
    });

    it('should propagate unknown errors directly to filter', async () => {
      authService.logout.mockRejectedValue(new Error('Unexpected'));
      const mockResponse = { clearCookie: jest.fn() };

      await expect(
        controller.logout('Bearer valid-token', mockResponse as any),
      ).rejects.toThrow(Error);
    });
  });
});
