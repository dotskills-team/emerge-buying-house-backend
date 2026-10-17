import { Schema, model } from 'mongoose';
import { ALL_PERMISSIONS, FALLBACK_ROLE, ROLE_KEYS } from '../../access/permissions.js';

const permissionList = { type: [{ type: String, enum: ALL_PERMISSIONS }], default: [] };

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_KEYS, default: FALLBACK_ROLE, index: true },
    /** Individual permissions added on top of the role. */
    grants: permissionList,
    /** Individual permissions removed from the role. */
    revokes: permissionList,
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const UserModel = model('User', userSchema);
