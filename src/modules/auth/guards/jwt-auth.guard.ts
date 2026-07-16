import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ITokenService } from '../../../common/ports/token.port';
import { TOKEN_SERVICE } from '../../../common/ports/token.token';
import { RedisService } from '../../redis/redis.service';
import type { AuthenticatedRequest } from '../auth.middleware';

interface GuardRequest extends AuthenticatedRequest {
  user?: { userId: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardRequest>();
    const token = request.accessToken;

    if (!token?.trim()) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const { userId } = await this.tokenService.verifyAccessToken(token);

      const isBlacklisted = await this.checkBlacklist(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      request.user = { userId };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn(`Token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async checkBlacklist(token: string): Promise<boolean> {
    try {
      const result = await this.redisService.get(`blacklist:${token}`);
      return result !== null;
    } catch (error) {
      this.logger.warn(
        `Redis blacklist check failed (failing open): ${(error as Error).message}`,
      );
      return false;
    }
  }
}
