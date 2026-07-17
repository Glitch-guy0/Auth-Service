import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@modules/auth/auth.module';
import { UserModule } from '@modules/user/user.module';
import { TokenModule } from '@modules/token/token.module';
import { LoggingModule } from '@modules/logging/logging.module';
import { KeyModule } from '@modules/key/key.module';
import { RedisModule } from '@modules/redis/redis.module';
import { AuthMiddleware } from '@modules/auth/auth.middleware';
import { LogManagerService } from '@shared/logging/log-manager';
import { LoggingInterceptor } from '@shared/logging/logging.interceptor';
import { TransformResponseInterceptor } from '@shared/interceptors/transform-response.interceptor';
import { User } from '@modules/user/user.entity';
import { AuthToken } from '@modules/token/auth-token.entity';
import { PublicKeyRegistry } from '@modules/key/public-key-registry.entity';

@Module({
  imports: [
    LoggingModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [User, AuthToken, PublicKeyRegistry],
        synchronize: config.get<string>('NODE_ENV') === 'test',
      }),
    }),
    AuthModule,
    UserModule,
    TokenModule,
    KeyModule,
    RedisModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logManager: LogManagerService) =>
        new LoggingInterceptor(logManager),
      inject: [LogManagerService],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
