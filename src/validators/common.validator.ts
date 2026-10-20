import { z } from 'zod';
import {
  isPermission,
  isRoleKey,
  type Permission,
  type RoleKey,
} from '../modules/access/permissions.js';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID');

export const idParamSchema = z.object({ id: objectIdSchema });

export const pageSchema = z.coerce.number().int().min(1).default(1);

export const roleSchema = z.custom<RoleKey>(isRoleKey, 'Unknown role');

export const permissionSchema = z.custom<Permission>(isPermission, 'Unknown permission');

/** A tiny inline image the browser shows, blurred, while the real photo loads. */
export const blurDataUrlSchema = z
  .string()
  .max(3000)
  .regex(/^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/, 'Invalid blur placeholder');
