import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DemographicsService } from '../demographics.service';
import {
  DemographicsRepository,
  DemographicsData,
} from '../demographics.repository';

describe('DemographicsService', () => {
  let service: DemographicsService;
  let repository: jest.Mocked<DemographicsRepository>;

  beforeEach(async () => {
    repository = {
      insert: jest.fn(),
    } as unknown as jest.Mocked<DemographicsRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemographicsService,
        { provide: DemographicsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<DemographicsService>(DemographicsService);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logDemographics', () => {
    it('should delegate to repository with correct field mapping', async () => {
      repository.insert.mockResolvedValue(undefined);

      await service.logDemographics('user-1', '192.168.1.1', {
        country: 'US',
        city: 'NYC',
      });

      expect(repository.insert).toHaveBeenCalledTimes(1);
      expect(repository.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        last_ip: '192.168.1.1',
        location: { country: 'US', city: 'NYC' },
      });
    });

    it('should use default location when location is not provided', async () => {
      repository.insert.mockResolvedValue(undefined);

      await service.logDemographics('user-2', '10.0.0.1');

      expect(repository.insert).toHaveBeenCalledWith({
        user_id: 'user-2',
        last_ip: '10.0.0.1',
        location: { country: 'unknown', city: 'unknown' },
      });
    });

    it('should not propagate repository errors', async () => {
      repository.insert.mockRejectedValue(new Error('DB down'));

      await expect(
        service.logDemographics('user-3', '172.16.0.1'),
      ).resolves.toBeUndefined();
    });

    it('should log a warning when repository throws', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      repository.insert.mockRejectedValue(new Error('Connection refused'));

      await service.logDemographics('user-4', '127.0.0.1');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('user-4'));
    });
  });
});
