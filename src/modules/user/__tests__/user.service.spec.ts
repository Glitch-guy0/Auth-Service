import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user.service';
import { User } from '../user.entity';
import { DemographicsService } from '../../logging/demographics.service';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Repository<User>>;
  let demographicsService: jest.Mocked<DemographicsService>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashed-password',
    blocked: false,
    is_verified: false,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    demographicsService = {
      logDemographics: jest.fn(),
    } as unknown as jest.Mocked<DemographicsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: DemographicsService, useValue: demographicsService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should return a user when found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when no user is found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
    });
  });

  describe('findByUsername', () => {
    it('should return a user when found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });

    it('should return null when no user is found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUsername('nonexistent');

      expect(result).toBeNull();
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'nonexistent' },
      });
    });
  });

  describe('create', () => {
    const dto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'securePass123',
    };

    it('should hash the password before saving', async () => {
      const createdUser = { ...mockUser, ...dto, password: 'hashed-value' };
      userRepository.create.mockReturnValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);

      await service.create(dto);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: dto.username,
          email: dto.email,
        }),
      );
      const savedPassword = userRepository.create.mock.calls[0][0]
        .password as string;
      expect(savedPassword).not.toBe(dto.password);
      const isValid = await bcrypt.compare(dto.password, savedPassword);
      expect(isValid).toBe(true);
    });

    it('should call create and save with correct data', async () => {
      const createdUser = { ...mockUser, ...dto, password: 'hashed' };
      userRepository.create.mockReturnValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);

      const result = await service.create(dto);

      expect(userRepository.create).toHaveBeenCalledTimes(1);
      expect(userRepository.save).toHaveBeenCalledWith(createdUser);
      expect(result).toEqual(createdUser);
    });

    it('should return the saved user entity', async () => {
      const savedUser: User = {
        ...mockUser,
        ...dto,
        password: 'hashed',
        id: 'uuid-123',
        created_at: new Date(),
        updated_at: new Date(),
      };
      userRepository.create.mockReturnValue(savedUser);
      userRepository.save.mockResolvedValue(savedUser);

      const result = await service.create(dto);

      expect(result.id).toBe('uuid-123');
      expect(result.username).toBe(dto.username);
      expect(result.email).toBe(dto.email);
    });
  });

  describe('logDemographics', () => {
    it('should delegate to DemographicsService with correct arguments', async () => {
      demographicsService.logDemographics.mockResolvedValue(undefined);

      await service.logDemographics('user-id', '127.0.0.1', {
        country: 'US',
        city: 'NYC',
      });

      expect(demographicsService.logDemographics).toHaveBeenCalledWith(
        'user-id',
        '127.0.0.1',
        { country: 'US', city: 'NYC' },
      );
    });

    it('should pass location as undefined when not provided', async () => {
      demographicsService.logDemographics.mockResolvedValue(undefined);

      await service.logDemographics('user-id', '10.0.0.1');

      expect(demographicsService.logDemographics).toHaveBeenCalledWith(
        'user-id',
        '10.0.0.1',
        undefined,
      );
    });
  });
});
