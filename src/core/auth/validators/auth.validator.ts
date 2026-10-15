import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address.')),
  // No complexity rules at login: those apply when a password is created.
  password: z.string().min(1, 'Password is required.').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;