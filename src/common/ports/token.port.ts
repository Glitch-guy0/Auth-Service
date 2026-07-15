import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';

export interface ITokenService {
  generateTokenPair(userId: string): Promise<TokenResponseDto>;
  storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  verifyAccessToken(token: string): Promise<{ userId: string }>;
}
