import { RegisterDto } from '@modules/auth/dto/register.dto';
import { LoginDto } from '@modules/auth/dto/login.dto';
import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';

export interface IAuthService {
  register(dto: RegisterDto): Promise<TokenResponseDto>;
  login(dto: LoginDto): Promise<TokenResponseDto>;
  refresh(refreshToken: string): Promise<TokenResponseDto>;
  logout(accessToken: string): Promise<void>;
}
