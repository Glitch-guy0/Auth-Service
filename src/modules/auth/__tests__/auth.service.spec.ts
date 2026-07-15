import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { UserExistsException } from '@shared/exceptions/validation.exception';
import { RegisterDto } from '@modules/auth/dto/register.dto';
import { User } from '@modules/user/user.entity';
import { USER_SERVICE } from '../../../common/ports/user.token';
import { TOKEN_SERVICE } from '../../../common/ports/token.token';

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
    it('should throw not implemented', async () => {
      await expect(service.login(validDto)).rejects.toThrow(
        'Not implemented',
      );
    });
  });

  describe('refresh', () => {
    it('should throw not implemented', async () => {
      await expect(service.refresh('token')).rejects.toThrow(
        'Not implemented',
      );
    });
  });

  describe('logout', () => {
    it('should throw not implemented', async () => {
      await expect(service.logout('userId')).rejects.toThrow(
        'Not implemented',
      );
    });
  });
});
