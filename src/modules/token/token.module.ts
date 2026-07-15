import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenService } from './token.service';
import { AuthToken } from './auth-token.entity';
import { KeyModule } from '../key/key.module';
import { TOKEN_SERVICE } from '../../common/ports/token.token';

@Module({
  imports: [TypeOrmModule.forFeature([AuthToken]), KeyModule],
  providers: [
    {
      provide: TOKEN_SERVICE,
      useClass: TokenService,
    },
  ],
  exports: [TOKEN_SERVICE],
})
export class TokenModule {}
