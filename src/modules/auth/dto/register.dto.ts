import { z } from 'zod';

/**
 * Registration request payload.
 * Validated against RegisterSchema before reaching the controller.
 */
export const RegisterSchema = z.object({
  /** Username — minimum 3 characters, must be unique */
  username: z.string().min(3),
  /** Email — must be valid format, must be unique */
  email: z.string().email(),
  /** Password — minimum 8 characters */
  password: z.string().min(8),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
