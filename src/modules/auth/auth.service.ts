import { Injectable, Logger, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IAuthService } from '../../common/ports/auth.port';
import { IUserService } from '../../common/ports/user.port';
import { ITokenService } from '../../common/ports/token.port';
import { RegisterDto } from './dto/register.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { UserExistsException } from '../../shared/exceptions/validation.exception';
import { USER_SERVICE } from '../../common/ports/user.token';
import { TOKEN_SERVICE } from '../../common/ports/token.token';

@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_SALT_ROUNDS = 12;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;

  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenResponseDto> {
    this.logger.log(`Registration attempt for username: ${dto.username}`);

    const [existingUsername, existingEmail] = await Promise.all([
      this.userService.findByUsername(dto.username),
      this.userService.findByEmail(dto.email),
    ]);

    if (existingUsername) {
      this.logger.warn(`Duplicate username attempt: ${dto.username}`);
      throw new UserExistsException('User already exists with this username');
    }
    if (existingEmail) {
      this.logger.warn(`Duplicate email attempt: ${dto.email}`);
      throw new UserExistsException('User already exists with this email');
    }

    const user = await this.userService.create(dto);

    this.logger.log(`User created: ${user.id}`);

    const tokens = await this.tokenService.generateTokenPair(user.id);

    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, this.BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);
    await this.tokenService.storeToken(user.id, refreshTokenHash, expiresAt);

    this.logger.log(`Registration complete for user: ${user.id}`);

    return tokens;
  }

  async login(_dto: any): Promise<TokenResponseDto> {
    throw new Error('Not implemented');
  }

  async refresh(_refreshToken: string): Promise<TokenResponseDto> {
    throw new Error('Not implemented');
  }

  async logout(_userId: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
