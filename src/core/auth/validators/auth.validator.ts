import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address.'));

/** The rule for every newly chosen password (admin-created, reset, or changed). */
export const newPasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128, 'Password must be at most 128 characters.');

export const loginSchema = z.object({
  email: emailSchema,
  // No complexity rules at login: those apply when a password is created.
  password: z.string().min(1, 'Password is required.').max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

const resetToken = z.string().min(20, 'Invalid reset link.').max(200, 'Invalid reset link.');

export const verifyResetSchema = z.object({ token: resetToken });

export const resetPasswordSchema = z.object({ token: resetToken, password: newPasswordSchema });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(128),
  newPassword: newPasswordSchema,
});
