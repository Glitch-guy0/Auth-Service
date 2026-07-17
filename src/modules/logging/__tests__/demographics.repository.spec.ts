import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { DemographicsRepository } from '../demographics.repository';
import { Demographics, DemographicsDocument } from '../demographics.schema';

describe('DemographicsRepository', () => {
  let repository: DemographicsRepository;
  let model: { create: jest.Mock };

  beforeEach(async () => {
    model = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemographicsRepository,
        { provide: getModelToken(Demographics.name), useValue: model },
      ],
    }).compile();

    repository = module.get<DemographicsRepository>(DemographicsRepository);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('insert', () => {
    it('should create a document with correct fields and created_at', async () => {
      const data = {
        user_id: 'user-123',
        last_ip: '192.168.1.1',
        location: { country: 'US', city: 'NYC' },
      };
      model.create.mockResolvedValue(undefined);

      await repository.insert(data);

      expect(model.create).toHaveBeenCalledTimes(1);
      const callArg = model.create.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.user_id).toBe('user-123');
      expect(callArg.last_ip).toBe('192.168.1.1');
      expect(callArg.location).toEqual({ country: 'US', city: 'NYC' });
      expect(callArg.created_at).toBeInstanceOf(Date);
    });

    it('should not throw when MongoDB insert fails', async () => {
      const data = {
        user_id: 'user-456',
        last_ip: '10.0.0.1',
      };
      model.create.mockRejectedValue(new Error('Connection lost'));

      await expect(repository.insert(data)).resolves.toBeUndefined();
    });

    it('should log a warning on insert failure', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const data = {
        user_id: 'user-789',
        last_ip: '172.16.0.1',
        location: { country: 'UK', city: 'London' },
      };
      model.create.mockRejectedValue(new Error('Timeout'));

      await repository.insert(data);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('user-789'));
    });

    it('should set created_at to current date', async () => {
      const before = Date.now();
      const data = {
        user_id: 'user-date',
        last_ip: '127.0.0.1',
      };
      model.create.mockResolvedValue(undefined);

      await repository.insert(data);

      const callArg = model.create.mock.calls[0][0] as Record<string, unknown>;
      const createdAt = (callArg.created_at as Date).getTime();
      expect(createdAt).toBeGreaterThanOrEqual(before);
      expect(createdAt).toBeLessThanOrEqual(Date.now());
    });
  });
});
