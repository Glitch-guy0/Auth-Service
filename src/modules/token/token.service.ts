import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignJWT, importPKCS8, jwtVerify, importSPKI } from 'jose';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { ITokenService } from '../../common/ports/token.port';
import { IKeyManager } from '../../common/ports/key-manager.port';
import { KEY_MANAGER } from '../../common/ports/key-manager.token';
import { JwtPayload } from '../../types/jwt.types';
import { TokenResponseDto } from '../auth/dto/token-response.dto';
import { AuthToken } from './auth-token.entity';
import {
  TokenInvalidSignatureException,
  TokenExpiredException,
} from '../../shared/exceptions/authentication.exception';
import { RedisService } from '../redis/redis.service';

interface RefreshTokenResult {
  rawToken: string;
  tokenHash: string;
}

@Injectable()
export class TokenService implements ITokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly algorithm = 'RS256';

  constructor(
    @Inject(KEY_MANAGER) private readonly keyManager: IKeyManager,
    private readonly configService: ConfigService,
    @InjectRepository(AuthToken)
    private readonly authTokenRepository: Repository<AuthToken>,
    private readonly redisService: RedisService,
  ) {}

  async generateTokenPair(_userId: string): Promise<TokenResponseDto> {
    void _userId;
    throw new Error('Not implemented');
  }

  async storeToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.authTokenRepository.query(
      `INSERT INTO auth_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET
         token_hash = EXCLUDED.token_hash,
         expires_at = EXCLUDED.expires_at,
         updated_at = NOW()`,
      [userId, tokenHash, expiresAt],
    );

    this.logger.debug(`Token stored for user ${userId}`);
  }

  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new TokenInvalidSignatureException(
          'Malformed token: expected 3 segments',
        );
      }

      const [, headerBase64] = parts;
      const header = JSON.parse(
        Buffer.from(headerBase64, 'base64url').toString(),
      );
      const kid = header.kid;

      if (!kid) {
        throw new TokenInvalidSignatureException('Missing kid in JWT header');
      }

      const publicKey = await this.keyManager.getPublicKey(kid);
      if (!publicKey) {
        throw new TokenInvalidSignatureException(
          'Public key not found for kid',
        );
      }

      const publicKeyObject = await importSPKI(publicKey, this.algorithm);
      const { payload } = await jwtVerify(token, publicKeyObject, {
        algorithms: [this.algorithm],
      });

      this.logger.debug(`Access token verified for user ${payload.sub}`);
      return { userId: payload.sub as string };
    } catch (error: unknown) {
      if (
        error instanceof TokenInvalidSignatureException ||
        error instanceof TokenExpiredException
      ) {
        throw error;
      }

      const err = error as Error;
      if (err.name === 'JWTExpired') {
        throw new TokenExpiredException('Token has expired');
      }

      if (
        err.name === 'JWTClaimValidationFailed' ||
        err.name === 'JWSSignatureVerificationFailed'
      ) {
        throw new TokenInvalidSignatureException('Invalid token signature');
      }

      throw new TokenInvalidSignatureException('Token verification failed');
    }
  }

  async findUserByRefreshToken(
    rawToken: string,
  ): Promise<{ userId: string; expiresAt: Date } | null> {
    const rows = await this.authTokenRepository.query(
      'SELECT user_id, token_hash, expires_at FROM auth_tokens',
    );

    for (const row of rows) {
      const match = await bcrypt.compare(rawToken, row.token_hash);
      if (match) {
        return { userId: row.user_id, expiresAt: row.expires_at };
      }
    }

    return null;
  }

  private async generateAccessToken(userId: string): Promise<string> {
    try {
      const privateKey = await this.keyManager.getPrivateKey();
      const kid = this.configService.get<string>('KEY_KID', 'default');
      const issuer = this.configService.get<string>(
        'AUTH_SERVICE_ISSUER',
        'auth-service',
      );
      const expiresIn = this.configService.get<number>(
        'ACCESS_TOKEN_EXPIRY_SECONDS',
        900,
      );

      const privateKeyObject = await importPKCS8(privateKey, this.algorithm);

      const now = Math.floor(Date.now() / 1000);
      const payload: JwtPayload = {
        sub: userId,
        iat: now,
        iss: issuer,
        kid,
        exp: now + expiresIn,
      };

      const jwt = await new SignJWT(
        payload as unknown as Record<string, unknown>,
      )
        .setProtectedHeader({ alg: this.algorithm, kid })
        .setIssuedAt(payload.iat)
        .setExpirationTime(payload.exp)
        .setIssuer(payload.iss)
        .setSubject(payload.sub)
        .sign(privateKeyObject);

      this.logger.debug(`Access token generated for user ${userId}`);
      return jwt;
    } catch (error) {
      this.logger.error(
        `Failed to generate access token for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  async deleteRefreshTokenByUserId(userId: string): Promise<void> {
    await this.authTokenRepository.query(
      'DELETE FROM auth_tokens WHERE user_id = $1',
      [userId],
    );
    this.logger.debug(`Refresh token deleted for user ${userId}`);
  }

  async blacklistToken(token: string, userId: string): Promise<void> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const exp = payload.exp as number;
      if (!exp) return;

      const now = Math.floor(Date.now() / 1000);
      const remainingTtl = Math.min(exp - now, 86400);
      if (remainingTtl <= 0) return;

      const blacklistKey = `blacklist:${token}`;
      const blacklistValue = JSON.stringify({
        expires_at: new Date(exp * 1000).toISOString(),
        user_id: userId,
      });

      await this.redisService.set(blacklistKey, blacklistValue, remainingTtl);
      this.logger.debug(
        `Token blacklisted for user ${userId}, TTL: ${remainingTtl}s`,
      );
    } catch (error) {
      this.logger.warn(
        `Token blacklisting failed (best-effort): ${(error as Error).message}`,
      );
    }
  }

  private async generateRefreshToken(): Promise<RefreshTokenResult> {
    try {
      const bytes = this.configService.get<number>('REFRESH_TOKEN_BYTES', 64);
      const saltRounds = this.configService.get<number>(
        'BCRYPT_SALT_ROUNDS',
        10,
      );

      const rawToken = crypto.randomBytes(bytes).toString('hex');
      const tokenHash = await bcrypt.hash(rawToken, saltRounds);

      this.logger.debug('Refresh token generated');
      return { rawToken, tokenHash };
    } catch (error) {
      this.logger.error('Failed to generate refresh token', error);
      throw error;
    }
  }
}
