import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegisterDto } from '../dto/register.dto';
import { UserExistsException } from '../../../shared/exceptions/validation.exception';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { register: jest.Mock };

  const validDto: RegisterDto = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
  };

  const mockTokens = {
    accessToken: 'access-token-value',
    refreshToken: 'refresh-token-value',
    expiresIn: 3600,
  };

  beforeEach(async () => {
    authService = { register: jest.fn().mockResolvedValue(mockTokens) };

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
      const result = await controller.register(validDto);

      expect(result).toEqual(mockTokens);
      expect(authService.register).toHaveBeenCalledWith(validDto);
    });

    it('should return TokenResponseDto from AuthService.register', async () => {
      const result = await controller.register(validDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should throw ConflictException when user already exists', async () => {
      authService.register.mockRejectedValue(
        new UserExistsException('User already exists with this username'),
      );

      await expect(controller.register(validDto)).rejects.toThrow(
        'User already exists with this username',
      );
    });

    it('should throw InternalServerErrorException for unexpected errors', async () => {
      const error = new Error('Unexpected error');
      authService.register.mockRejectedValue(error);

      await expect(controller.register(validDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('ZodValidationPipe', () => {
    it('should reject invalid input before reaching the controller', async () => {
      const { ZodValidationPipe } = require('../pipes/zod-validation.pipe');
      const { RegisterSchema } = require('../dto/register.dto');
      const { BadRequestException } = require('@nestjs/common');

      const pipe = new ZodValidationPipe(RegisterSchema);

      expect(() => pipe.transform({})).toThrow(BadRequestException);
      expect(() =>
        pipe.transform({ username: 'ab', email: 'bad', password: 'short' }),
      ).toThrow(BadRequestException);
    });

    it('should accept valid input', () => {
      const { ZodValidationPipe } = require('../pipes/zod-validation.pipe');
      const { RegisterSchema } = require('../dto/register.dto');

      const pipe = new ZodValidationPipe(RegisterSchema);
      const result = pipe.transform(validDto);

      expect(result).toEqual(validDto);
    });
  });
});
