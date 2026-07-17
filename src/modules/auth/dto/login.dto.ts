import { z } from 'zod';

/**
 * Login request payload.
 * Validated against LoginSchema before reaching the controller.
 */
export const LoginSchema = z.object({
  /** Username or email — minimum 3, maximum 254 characters */
  usernameOrEmail: z.string().min(3).max(254),
  /** Password — minimum 8, maximum 20 characters */
  password: z.string().min(8).max(20),
});

export type LoginDto = z.infer<typeof LoginSchema>;
