import { z } from 'zod';
import { emailSchema, newPasswordSchema } from '../../../core/auth/validators/auth.validator.js';
import { pageSchema, permissionSchema, roleSchema } from '../../../validators/common.validator.js';

const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters.').max(100);

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: roleSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  role: roleSchema,
});

export const updateUserSchema = z
  .object({ name: nameSchema, email: emailSchema })
  .partial()
  .refine((v) => v.name !== undefined || v.email !== undefined, 'Nothing to update.');

export const updateRoleSchema = z.object({ role: roleSchema });

export const updateStatusSchema = z.object({ isActive: z.boolean() });

export const updatePermissionsSchema = z.object({
  grants: z.array(permissionSchema).max(50),
  revokes: z.array(permissionSchema).max(50),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;
