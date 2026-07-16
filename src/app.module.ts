import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '@modules/auth/auth.module';
import { UserModule } from '@modules/user/user.module';
import { TokenModule } from '@modules/token/token.module';
import { LoggingModule } from '@modules/logging/logging.module';
import { KeyModule } from '@modules/key/key.module';
import { RedisModule } from '@modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UserModule,
    TokenModule,
    LoggingModule,
    KeyModule,
    RedisModule,
  ],
})
export class AppModule {}
