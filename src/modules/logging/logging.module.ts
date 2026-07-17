import { Global, Module, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { LogManagerService } from '@shared/logging/log-manager';
import { Demographics, DemographicsSchema } from './demographics.schema';
import { DemographicsRepository } from './demographics.repository';
import { DemographicsService } from './demographics.service';

const LogManagerProvider = {
  provide: LogManagerService,
  useFactory: () => new LogManagerService(process.env.LOG_LEVEL ?? 'info'),
};

@Global()
@Module({
  providers: [LogManagerProvider, DemographicsService],
  exports: [LogManagerService, DemographicsService],
})
export class LoggingModule {
  static forRoot() {
    const hasMongo = !!process.env.MONGODB_URL;

    if (hasMongo) {
      Logger.log(
        'MONGODB_URL detected — enabling demographics',
        'LoggingModule',
      );
    } else {
      Logger.warn(
        'MONGODB_URL not set — demographics collection disabled',
        'LoggingModule',
      );
    }

    return {
      module: LoggingModule,
      imports: hasMongo
        ? [
            MongooseModule.forRootAsync({
              inject: [ConfigService],
              useFactory: (configService: ConfigService) => ({
                uri: configService.get<string>('MONGODB_URL'),
              }),
            }),
            MongooseModule.forFeature([
              { name: Demographics.name, schema: DemographicsSchema },
            ]),
          ]
        : [],
      providers: hasMongo
        ? [LogManagerProvider, DemographicsRepository, DemographicsService]
        : [LogManagerProvider, DemographicsService],
      exports: [LogManagerService, DemographicsService],
    };
  }
}
