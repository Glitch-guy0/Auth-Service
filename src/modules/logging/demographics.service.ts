import { Injectable, Logger, Optional } from '@nestjs/common';
import { DemographicsRepository } from './demographics.repository';
import { geoLookup } from '../../shared/utils/geo-lookup';

@Injectable()
export class DemographicsService {
  private readonly logger = new Logger(DemographicsService.name);

  constructor(
    @Optional() private readonly demographicsRepository: DemographicsRepository,
  ) {}

  async logDemographics(
    userId: string,
    ip: string,
    location?: { country: string; city: string },
  ): Promise<void> {
    try {
      const resolvedLocation = location ?? geoLookup(ip);
      await this.demographicsRepository.insert({
        user_id: userId,
        last_ip: ip,
        location: resolvedLocation,
      });
    } catch (error) {
      this.logger.warn(
        `Demographics logging failed for user ${userId}: ${(error as Error).message}`,
      );
    }
  }
}
