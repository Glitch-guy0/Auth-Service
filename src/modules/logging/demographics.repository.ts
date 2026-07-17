import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Demographics, DemographicsDocument } from './demographics.schema';

export interface DemographicsData {
  user_id: string;
  last_ip: string;
  location?: { country: string; city: string };
}

@Injectable()
export class DemographicsRepository {
  private readonly logger = new Logger(DemographicsRepository.name);

  constructor(
    @InjectModel(Demographics.name)
    private readonly model: Model<DemographicsDocument>,
  ) {}

  async insert(data: DemographicsData): Promise<void> {
    try {
      await this.model.create({ ...data, created_at: new Date() });
    } catch (error) {
      this.logger.warn(
        `Failed to insert demographics for user ${data.user_id}: ${(error as Error).message}`,
      );
    }
  }
}
