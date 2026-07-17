import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { UserModule } from '@modules/user/user.module';
import { TokenModule } from '@modules/token/token.module';
import { LoggingModule } from '@modules/logging/logging.module';
import { KeyModule } from '@modules/key/key.module';
import { RedisModule } from '@modules/redis/redis.module';
import { AuthMiddleware } from '@modules/auth/auth.middleware';
import { LogManagerService } from '@shared/logging/log-manager';
import { LoggingInterceptor } from '@shared/logging/logging.interceptor';

@Module({
  imports: [
    LoggingModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
