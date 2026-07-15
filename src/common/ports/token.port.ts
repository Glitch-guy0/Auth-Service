import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';

export interface ITokenService {
  generateTokenPair(userId: string): Promise<TokenResponseDto>;
  storeToken(userId: string, tokenHash: string): Promise<void>;
  verifyAccessToken(token: string): Promise<{ userId: string }>;
}
