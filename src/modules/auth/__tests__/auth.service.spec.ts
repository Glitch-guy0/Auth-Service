import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { UserExistsException } from '@shared/exceptions/validation.exception';
import {
  InvalidCredentialsException,
  TokenExpiredException,
} from '@shared/exceptions/authentication.exception';
import { UserBlockedException } from '@shared/exceptions/authorization.exception';
import { RegisterDto } from '@modules/auth/dto/register.dto';
import { LoginDto } from '@modules/auth/dto/login.dto';
import { User } from '@modules/user/user.entity';
import { USER_SERVICE } from '@shared/lib/interfaces/user.token';
import { TOKEN_SERVICE } from '@shared/lib/interfaces/token.token';

jest.mock('bcrypt');

const mockUserService = () => ({
  findByUsername: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  logDemographics: jest.fn(),
});

const mockTokenService = () => ({
  generateTokenPair: jest.fn(),
  storeToken: jest.fn(),
  verifyAccessToken: jest.fn(),
  findUserByRefreshToken: jest.fn(),
  deleteRefreshTokenByUserId: jest.fn(),
  blacklistToken: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let userService: ReturnType<typeof mockUserService>;
  let tokenService: ReturnType<typeof mockTokenService>;

  const validDto: RegisterDto = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
  };

  const mockUser: User = {
    id: 'uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashed-password',
    blocked: false,
    is_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTokens = {
    accessToken: 'access-token-value',
    refreshToken: 'refresh-token-value',
    expiresIn: 3600,
  };

  beforeEach(async () => {
    userService = mockUserService();
    tokenService = mockTokenService();

    userService.create.mockResolvedValue(mockUser);
    tokenService.generateTokenPair.mockResolvedValue(mockTokens);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: USER_SERVICE, useValue: userService },
        { provide: TOKEN_SERVICE, useValue: tokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    beforeEach(() => {
      userService.logDemographics.mockResolvedValue(undefined);
    });

    it('should register a user and return tokens', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);

      const result = await service.register(validDto);

      expect(result).toEqual(mockTokens);
    });

    it('should check username and email uniqueness in parallel', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);

      await service.register(validDto);

      expect(userService.findByUsername).toHaveBeenCalledWith('testuser');
      expect(userService.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should create user via userService.create', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);

      await service.register(validDto);

      expect(userService.create).toHaveBeenCalledWith(validDto);
    });

    it('should generate token pair with user id', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);

      await service.register(validDto);

      expect(tokenService.generateTokenPair).toHaveBeenCalledWith('uuid-123');
    });

    it('should hash refresh token and store it', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');

      await service.register(validDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('refresh-token-value', 12);
      expect(tokenService.storeToken).toHaveBeenCalledWith(
        'uuid-123',
        'hashed-refresh-token',
        expect.any(Date),
      );
    });

    it('should throw UserExistsException for duplicate username', async () => {
      userService.findByUsername.mockResolvedValue(mockUser);
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.register(validDto)).rejects.toThrow(
        UserExistsException,
      );
      await expect(service.register(validDto)).rejects.toThrow(
        'User already exists with this username',
      );
    });

    it('should throw UserExistsException for duplicate email', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(validDto)).rejects.toThrow(
        UserExistsException,
      );
      await expect(service.register(validDto)).rejects.toThrow(
        'User already exists with this email',
      );
    });

    it('should not create user when username already exists', async () => {
      userService.findByUsername.mockResolvedValue(mockUser);
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.register(validDto)).rejects.toThrow();
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('should not generate tokens when user already exists', async () => {
      userService.findByUsername.mockResolvedValue(mockUser);
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.register(validDto)).rejects.toThrow();
      expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
    });

    it('should not store token when user already exists', async () => {
      userService.findByUsername.mockResolvedValue(null);
      userService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(validDto)).rejects.toThrow();
      expect(tokenService.storeToken).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      usernameOrEmail: 'test@example.com',
      password: 'password123',
    };

    beforeEach(() => {
      userService.findByEmail.mockResolvedValue(mockUser);
      userService.findByUsername.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      tokenService.generateTokenPair.mockResolvedValue(mockTokens);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      userService.logDemographics.mockResolvedValue(undefined);
    });

    it('should return tokens for valid email login', async () => {
      const result = await service.login(loginDto);
      expect(result).toEqual(mockTokens);
    });

    it('should return tokens for valid username login', async () => {
      const usernameDto: LoginDto = {
        usernameOrEmail: 'testuser',
        password: 'password123',
      };
      userService.findByUsername.mockResolvedValue(mockUser);
      userService.findByEmail.mockResolvedValue(null);

      const result = await service.login(usernameDto);
      expect(result).toEqual(mockTokens);
    });

    it('should throw InvalidCredentialsException for non-existent user', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('should throw InvalidCredentialsException for wrong password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('should throw UserBlockedException for blocked user', async () => {
      const blockedUser = { ...mockUser, blocked: true };
      userService.findByEmail.mockResolvedValue(blockedUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        UserBlockedException,
      );
    });

    it('should generate token pair with user id', async () => {
      await service.login(loginDto);
      expect(tokenService.generateTokenPair).toHaveBeenCalledWith('uuid-123');
    });

    it('should hash and store refresh token', async () => {
      await service.login(loginDto);
      expect(bcrypt.hash).toHaveBeenCalledWith('refresh-token-value', 12);
      expect(tokenService.storeToken).toHaveBeenCalledWith(
        'uuid-123',
        'hashed-refresh-token',
        expect.any(Date),
      );
    });

    it('should call logDemographics fire-and-forget', async () => {
      await service.login(loginDto);
      expect(userService.logDemographics).toHaveBeenCalledWith('uuid-123', '');
    });

    it('should still succeed if logDemographics fails', async () => {
      userService.logDemographics.mockRejectedValue(
        new Error('MongoDB unavailable'),
      );

      const result = await service.login(loginDto);
      expect(result).toEqual(mockTokens);
    });
  });

  describe('refresh', () => {
    const mockTokenRecord = {
      userId: 'uuid-123',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    beforeEach(() => {
      tokenService.findUserByRefreshToken.mockResolvedValue(mockTokenRecord);
      tokenService.generateTokenPair.mockResolvedValue(mockTokens);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-refresh-token');
    });

    it('should return new tokens for valid refresh token', async () => {
      const result = await service.refresh('valid-refresh-token');
      expect(result).toEqual(mockTokens);
    });

    it('should call findUserByRefreshToken with the raw token', async () => {
      await service.refresh('valid-refresh-token');
      expect(tokenService.findUserByRefreshToken).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
    });

    it('should throw InvalidCredentialsException when token not found', async () => {
      tokenService.findUserByRefreshToken.mockResolvedValue(null);
      await expect(service.refresh('invalid-token')).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('should throw TokenExpiredException when token expired', async () => {
      tokenService.findUserByRefreshToken.mockResolvedValue({
        userId: 'uuid-123',
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('expired-token')).rejects.toThrow(
        TokenExpiredException,
      );
    });

    it('should generate new token pair with user id', async () => {
      await service.refresh('valid-refresh-token');
      expect(tokenService.generateTokenPair).toHaveBeenCalledWith('uuid-123');
    });

    it('should hash new refresh token and store it', async () => {
      await service.refresh('valid-refresh-token');
      expect(bcrypt.hash).toHaveBeenCalledWith('refresh-token-value', 12);
      expect(tokenService.storeToken).toHaveBeenCalledWith(
        'uuid-123',
        'new-hashed-refresh-token',
        expect.any(Date),
      );
    });

    it('should throw InvalidCredentialsException for empty token', async () => {
      await expect(service.refresh('')).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('should throw InvalidCredentialsException for null/undefined token', async () => {
      await expect(service.refresh(null as any)).rejects.toThrow(
        InvalidCredentialsException,
      );
      await expect(service.refresh(undefined as any)).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('should throw InvalidCredentialsException when storeToken fails after token generation', async () => {
      tokenService.storeToken.mockRejectedValue(
        new Error('DB connection failed'),
      );
      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        InvalidCredentialsException,
      );
    });
  });

  describe('logout', () => {
    it('should verify token, delete refresh token, and blacklist access token', async () => {
      tokenService.verifyAccessToken.mockResolvedValue({ userId: 'uuid-123' });
      tokenService.deleteRefreshTokenByUserId.mockResolvedValue(undefined);
      tokenService.blacklistToken.mockResolvedValue(undefined);

      await service.logout('valid-access-token');

      expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(
        'valid-access-token',
      );
      expect(tokenService.deleteRefreshTokenByUserId).toHaveBeenCalledWith(
        'uuid-123',
      );
      expect(tokenService.blacklistToken).toHaveBeenCalledWith(
        'valid-access-token',
        'uuid-123',
      );
    });

    it('should silently succeed for invalid/expired token', async () => {
      tokenService.verifyAccessToken.mockRejectedValue(
        new Error('Token expired'),
      );

      await expect(service.logout('expired-token')).resolves.toBeUndefined();
      expect(tokenService.deleteRefreshTokenByUserId).not.toHaveBeenCalled();
    });

    it('should silently succeed when DB delete fails', async () => {
      tokenService.verifyAccessToken.mockResolvedValue({ userId: 'uuid-123' });
      tokenService.deleteRefreshTokenByUserId.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(service.logout('valid-token')).resolves.toBeUndefined();
    });

    it('should succeed when Redis blacklist fails', async () => {
      tokenService.verifyAccessToken.mockResolvedValue({ userId: 'uuid-123' });
      tokenService.deleteRefreshTokenByUserId.mockResolvedValue(undefined);
      tokenService.blacklistToken.mockRejectedValue(new Error('Redis down'));

      await expect(service.logout('valid-token')).resolves.toBeUndefined();
      expect(tokenService.deleteRefreshTokenByUserId).toHaveBeenCalled();
    });
  });
});
