import { TokenResponseDto } from '@modules/auth/dto/token-response.dto';

/**
 * Port interface defining the token service contract.
 *
 * Implementations handle JWT creation, verification, storage,
 * refresh token rotation, and access token blacklisting. Callers
 * depend on this interface rather than concrete implementations,
 * following hexagonal architecture principles.
 */
export interface ITokenService {
  /**
   * Generate a new access and refresh token pair for a user.
   *
   * @param userId - The user's UUID to embed in the access token
   * @returns Promise resolving to the token pair with expiration seconds
   */
  generateTokenPair(userId: string): Promise<TokenResponseDto>;

  /**
   * Store or update a refresh token hash for a user.
   *
   * @param userId - The user's UUID
   * @param tokenHash - Bcrypt hash of the raw refresh token
   * @param expiresAt - Expiration timestamp of the refresh token
   */
  storeToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;

  /**
   * Verify an RSA-signed access token and extract the user ID.
   *
   * @param token - The raw JWT access token string
   * @returns Object containing the authenticated user's UUID
   * @throws {TokenInvalidSignatureException} If the token is malformed or the signature is invalid
   * @throws {TokenExpiredException} If the token has expired
   */
  verifyAccessToken(token: string): Promise<{ userId: string }>;

  /**
   * Find the user associated with a raw refresh token.
   *
   * @param rawToken - The plain-text refresh token to match
   * @returns The user ID and token expiration, or null if no match found
   */
  findUserByRefreshToken(
    rawToken: string,
  ): Promise<{ userId: string; expiresAt: Date } | null>;

  /**
   * Delete the refresh token record for a given user.
   *
   * @param userId - The user's UUID whose token should be deleted
   */
  deleteRefreshTokenByUserId(userId: string): Promise<void>;

  /**
   * Blacklist an access token in Redis to revoke it before expiry.
   *
   * @param token - The raw JWT access token to blacklist
   * @param userId - The user's UUID (stored as metadata in Redis)
   */
  blacklistToken(token: string, userId: string): Promise<void>;
}
