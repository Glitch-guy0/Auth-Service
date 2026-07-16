import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';

export interface ITokenService {
  generateTokenPair(userId: string): Promise<TokenResponseDto>;
  storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  verifyAccessToken(token: string): Promise<{ userId: string }>;
  findUserByRefreshToken(
    rawToken: string,
  ): Promise<{ userId: string; expiresAt: Date } | null>;
  deleteRefreshTokenByUserId(userId: string): Promise<void>;
  blacklistToken(token: string, userId: string): Promise<void>;
}
