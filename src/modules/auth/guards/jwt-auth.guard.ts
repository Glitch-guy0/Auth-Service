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

/**
 * NestJS guard that validates the bearer access token on protected routes.
 *
 * Reads the access token set by `AuthMiddleware` on the request, verifies it
 * via {@link ITokenService.verifyAccessToken}, checks the Redis blacklist,
 * and enriches the request with the authenticated user's ID.
 *
 * Implements fail-open semantics for Redis blacklist checks — if Redis is
 * unreachable, the check is skipped rather than rejecting the request.
 *
 * @implements {CanActivate}
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Validate the incoming request by checking the bearer access token.
   *
   * Extracts the token from the request (set by AuthMiddleware), verifies
   * it via TokenService, checks the Redis blacklist, and enriches the request
   * with the authenticated user's ID.
   *
   * @param context - NestJS execution context providing the HTTP request
   * @returns Promise resolving to true if the token is valid and not revoked
   * @throws {UnauthorizedException} If token is missing, invalid, expired, or revoked
   */
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
