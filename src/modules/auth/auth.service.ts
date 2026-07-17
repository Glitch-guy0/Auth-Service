import { Injectable, Logger, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IAuthService } from '../../common/ports/auth.port';
import { IUserService } from '../../common/ports/user.port';
import { ITokenService } from '../../common/ports/token.port';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { UserExistsException } from '../../shared/exceptions/validation.exception';
import {
  InvalidCredentialsException,
  TokenExpiredException,
} from '../../shared/exceptions/authentication.exception';
import { UserBlockedException } from '../../shared/exceptions/authorization.exception';
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

  async register(dto: RegisterDto, ip?: string): Promise<TokenResponseDto> {
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

    const refreshTokenHash = await bcrypt.hash(
      tokens.refreshToken,
      this.BCRYPT_SALT_ROUNDS,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);
    await this.tokenService.storeToken(user.id, refreshTokenHash, expiresAt);

    this.userService.logDemographics(user.id, ip ?? '').catch(() => {});

    this.logger.log(`Registration complete for user: ${user.id}`);

    return tokens;
  }

  async login(dto: LoginDto, ip?: string): Promise<TokenResponseDto> {
    this.logger.log(`Login attempt for: ${dto.usernameOrEmail}`);

    const user = dto.usernameOrEmail.includes('@')
      ? await this.userService.findByEmail(dto.usernameOrEmail)
      : await this.userService.findByUsername(dto.usernameOrEmail);

    if (!user) {
      this.logger.warn(
        `Login failed: user not found for ${dto.usernameOrEmail}`,
      );
      throw new InvalidCredentialsException();
    }

    if (user.blocked) {
      this.logger.warn(`Login blocked: user ${user.id} is blocked`);
      throw new UserBlockedException();
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      this.logger.warn(`Login failed: invalid password for user ${user.id}`);
      throw new InvalidCredentialsException();
    }

    const tokens = await this.tokenService.generateTokenPair(user.id);

    const refreshTokenHash = await bcrypt.hash(
      tokens.refreshToken,
      this.BCRYPT_SALT_ROUNDS,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);
    await this.tokenService.storeToken(user.id, refreshTokenHash, expiresAt);

    this.userService.logDemographics(user.id, ip ?? '').catch(() => {});

    this.logger.log(`Login successful for user: ${user.id}`);

    return tokens;
  }

  async refresh(refreshToken: string): Promise<TokenResponseDto> {
    this.logger.log('Token refresh attempt');

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new InvalidCredentialsException('Invalid refresh token');
    }

    const tokenRecord =
      await this.tokenService.findUserByRefreshToken(refreshToken);

    if (!tokenRecord) {
      this.logger.warn('Refresh failed: token not found or invalid');
      throw new InvalidCredentialsException('Invalid refresh token');
    }

    if (new Date(tokenRecord.expiresAt) < new Date()) {
      this.logger.warn(
        `Refresh failed: token expired for user ${tokenRecord.userId}`,
      );
      throw new TokenExpiredException('Refresh token has expired');
    }

    const tokens = await this.tokenService.generateTokenPair(
      tokenRecord.userId,
    );

    try {
      const refreshTokenHash = await bcrypt.hash(
        tokens.refreshToken,
        this.BCRYPT_SALT_ROUNDS,
      );
      const expiresAt = new Date(
        Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );
      await this.tokenService.storeToken(
        tokenRecord.userId,
        refreshTokenHash,
        expiresAt,
      );
    } catch (error) {
      this.logger.error(
        `Token rotation failed for user ${tokenRecord.userId}: ${(error as Error).message}`,
      );
      throw new InvalidCredentialsException('Token refresh failed');
    }

    this.logger.log(`Token refresh successful for user: ${tokenRecord.userId}`);

    return tokens;
  }

  async logout(accessToken: string): Promise<void> {
    try {
      const { userId } = await this.tokenService.verifyAccessToken(accessToken);

      try {
        await this.tokenService.deleteRefreshTokenByUserId(userId);
      } catch (dbError) {
        this.logger.error(
          `DB logout failed for user ${userId}: ${(dbError as Error).message}`,
        );
      }

      await this.tokenService
        .blacklistToken(accessToken, userId)
        .catch((err) => {
          this.logger.warn(
            `Redis blacklist failed (best-effort): ${err.message}`,
          );
        });

      this.logger.log(`Logout successful for user: ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Logout completed (token may be invalid/expired): ${(error as Error).message}`,
      );
    }
  }
}
