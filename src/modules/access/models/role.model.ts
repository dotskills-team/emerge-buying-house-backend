import { Schema, model } from 'mongoose';
import { ALL_PERMISSIONS, ROLE_KEYS } from '../permissions.js';

/**
 * Stored role definitions. The set of roles is fixed (ROLE_KEYS); only a standard role's
 * permission list is editable. `version` is bumped inside transactions that must not run
 * concurrently with each other (see users.service), turning write skew into a write conflict.
 */
const roleSchema = new Schema(
  {
    key: { type: String, enum: ROLE_KEYS, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    permissions: { type: [{ type: String, enum: ALL_PERMISSIONS }], default: [] },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const RoleModel = model('Role', roleSchema);
