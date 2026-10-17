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
