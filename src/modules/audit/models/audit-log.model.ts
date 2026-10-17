import { Schema, model } from 'mongoose';

export const AUDIT_ACTIONS = [
  'user.create',
  'user.update',
  'user.role.change',
  'user.status.change',
  'user.permissions.change',
  'role.permissions.change',
  'auth.password.reset',
  'auth.password.change',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    targetType: { type: String, enum: ['user', 'role'], required: true },
    targetId: { type: String, required: true },
    // Never holds secrets: only names, roles, statuses and permission keys.
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const AuditLogModel = model('AuditLog', auditLogSchema);
