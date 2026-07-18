import { RegisterDto } from '@modules/auth/dto/register.dto';
import { LoginDto } from '@modules/auth/dto/login.dto';
import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';

/**
 * Port interface defining the authentication service contract.
 *
 * Implementations orchestrate user registration, login, token refresh,
 * and logout use cases. Callers depend on this interface rather than
 * concrete implementations, following hexagonal architecture principles.
 */
export interface IAuthService {
  /**
   * Register a new user account.
   *
   * @param dto - Registration data (username, email, password)
   * @param ip - Client IP address for demographics logging (optional)
   * @returns Promise resolving to access token and expiration
   * @throws {UserExistsException} If username or email already exists
   */
  register(dto: RegisterDto, ip?: string): Promise<TokenResponseDto>;

  /**
   * Authenticate a user by username or email and password.
   *
   * @param dto - Login credentials (usernameOrEmail, password)
   * @param ip - Client IP address for demographics logging (optional)
   * @returns Promise resolving to access token and expiration
   * @throws {InvalidCredentialsException} If credentials are invalid
   * @throws {UserBlockedException} If the user account is blocked
   */
  login(dto: LoginDto, ip?: string): Promise<TokenResponseDto>;

  /**
   * Refresh an access token using a valid refresh token.
   *
   * @param refreshToken - The raw refresh token from the cookie
   * @returns Promise resolving to a new token pair
   * @throws {InvalidCredentialsException} If the token is invalid
   * @throws {TokenExpiredException} If the refresh token has expired
   */
  refresh(refreshToken: string): Promise<TokenResponseDto>;

  /**
   * Log out a user by invalidating their session.
   *
   * @param accessToken - The JWT access token from the Authorization header
   */
  logout(accessToken: string): Promise<void>;
}
