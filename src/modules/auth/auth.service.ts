import { Injectable, Logger, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IAuthService } from '@shared/lib/interfaces/auth.interface';
import { IUserService } from '@shared/lib/interfaces/user.interface';
import { ITokenService } from '@shared/lib/interfaces/token.interface';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { UserExistsException } from '@shared/exceptions/validation.exception';
import {
  InvalidCredentialsException,
  TokenExpiredException,
} from '@shared/exceptions/authentication.exception';
import { UserBlockedException } from '@shared/exceptions/authorization.exception';
import { USER_SERVICE } from '@shared/lib/interfaces/user.token';
import { TOKEN_SERVICE } from '@shared/lib/interfaces/token.token';

/**
 * Core authentication service orchestrating user registration, login,
 * token refresh, and logout use cases.
 *
 * Delegates user persistence to {@link IUserService} and token operations
 * to {@link ITokenService}. Follows hexagonal architecture — depends only
 * on port interfaces, not concrete implementations.
 *
 * @implements {IAuthService}
 */
@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_SALT_ROUNDS = 12;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;

  constructor(
    @Inject(USER_SERVICE) private readonly userService: IUserService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
  ) {}

  /**
   * Register a new user account.
   *
   * Validates username and email uniqueness, hashes the password with bcrypt,
   * creates the user record, generates a token pair, stores the refresh token
   * hash, and fires a best-effort demographics log.
   *
   * @param dto - Registration data (username, email, password)
   * @param ip - Client IP address for demographics logging (optional)
   * @returns Promise resolving to token pair (accessToken, refreshToken, expiresIn)
   * @throws {UserExistsException} If username or email already exists
   *
   * @example
   * ```typescript
   * const tokens = await authService.register({
   *   username: 'alice',
   *   email: 'alice@example.com',
   *   password: 'securepass123',
   * });
   * // { accessToken: 'eyJ...', refreshToken: '...', expiresIn: 86400 }
   * ```
   */
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

  /**
   * Authenticate a user by username or email and password.
   *
   * Looks up the user by email (if the input contains '@') or username,
   * verifies the password with bcrypt, checks for blocked accounts,
   * and rotates the token pair on success.
   *
   * @param dto - Login credentials (usernameOrEmail, password)
   * @param ip - Client IP address for demographics logging (optional)
   * @returns Promise resolving to token pair (accessToken, refreshToken, expiresIn)
   * @throws {InvalidCredentialsException} If user not found or password is wrong
   * @throws {UserBlockedException} If the user account is blocked
   *
   * @example
   * ```typescript
   * const tokens = await authService.login({
   *   usernameOrEmail: 'alice',
   *   password: 'securepass123',
   * });
   * // { accessToken: 'eyJ...', refreshToken: '...', expiresIn: 86400 }
   * ```
   */
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

  /**
   * Refresh an access token using a valid refresh token.
   *
   * Looks up the refresh token hash in the database via a linear bcrypt
   * comparison scan, checks expiry, then rotates the token pair (generates
   * new access + refresh tokens, stores the new hash).
   *
   * @param refreshToken - The raw refresh token from the cookie
   * @returns Promise resolving to a new token pair (accessToken, refreshToken, expiresIn)
   * @throws {InvalidCredentialsException} If the token is invalid or rotation fails
   * @throws {TokenExpiredException} If the refresh token has expired
   */
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

  /**
   * Log out a user by invalidating their session.
   *
   * Verifies the access token to extract the user ID, deletes the refresh
   * token from the database, and adds the access token to the Redis blacklist
   * (best-effort — Redis failures are silently caught). The outer try/catch
   * ensures the logout completes even if the token is invalid or expired.
   *
   * @param accessToken - The JWT access token from the Authorization header
   */
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
