import { z } from 'zod';

export const LoginSchema = z.object({
  usernameOrEmail: z.string().min(3).max(254),
  password: z.string().min(8).max(20),
});

export type LoginDto = z.infer<typeof LoginSchema>;
