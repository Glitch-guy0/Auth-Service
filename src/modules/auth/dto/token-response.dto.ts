import { z } from 'zod';

/**
 * Token pair response returned after successful authentication.
 * Contains the access token, refresh token, and expiration in seconds.
 */
export const TokenResponseSchema = z.object({
  /** JWT access token signed with RSA-256 */
  accessToken: z.string(),
  /** Raw refresh token (stored in httpOnly cookie by the controller) */
  refreshToken: z.string(),
  /** Access token lifetime in seconds (e.g. 86400 for 1 day) */
  expiresIn: z.number(),
});

export type TokenResponseDto = z.infer<typeof TokenResponseSchema>;
