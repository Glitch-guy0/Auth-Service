import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignJWT, importPKCS8 } from 'jose';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { ITokenService } from '../../common/ports/token.port';
import { IKeyManager } from '../../common/ports/key-manager.port';
import { KEY_MANAGER } from '../../common/ports/key-manager.token';
import { JwtPayload } from '../../types/jwt.types';
import { TokenResponseDto } from '../auth/dto/token-response.dto';
import { AuthToken } from './auth-token.entity';

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
  ) {}

  async generateTokenPair(_userId: string): Promise<TokenResponseDto> {
    throw new Error('Not implemented');
  }

  async storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
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

  async verifyAccessToken(_token: string): Promise<{ userId: string }> {
    throw new Error('Not implemented');
  }

  private async generateAccessToken(userId: string): Promise<string> {
    try {
      const privateKey = await this.keyManager.getPrivateKey();
      const kid = this.configService.get<string>('KEY_KID', 'default');
      const issuer = this.configService.get<string>('AUTH_SERVICE_ISSUER', 'auth-service');
      const expiresIn = this.configService.get<number>('ACCESS_TOKEN_EXPIRY_SECONDS', 900);

      const privateKeyObject = await importPKCS8(privateKey, this.algorithm);

      const now = Math.floor(Date.now() / 1000);
      const payload: JwtPayload = {
        sub: userId,
        iat: now,
        iss: issuer,
        kid,
        exp: now + expiresIn,
      };

      const jwt = await new SignJWT(payload as unknown as Record<string, unknown>)
        .setProtectedHeader({ alg: this.algorithm, kid })
        .setIssuedAt(payload.iat)
        .setExpirationTime(payload.exp)
        .setIssuer(payload.iss)
        .setSubject(payload.sub)
        .sign(privateKeyObject);

      this.logger.debug(`Access token generated for user ${userId}`);
      return jwt;
    } catch (error) {
      this.logger.error(`Failed to generate access token for user ${userId}`, error);
      throw error;
    }
  }

  private async generateRefreshToken(): Promise<RefreshTokenResult> {
    try {
      const bytes = this.configService.get<number>('REFRESH_TOKEN_BYTES', 64);
      const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 10);

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
