import { z } from 'zod';

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});

export type TokenResponseDto = z.infer<typeof TokenResponseSchema>;
