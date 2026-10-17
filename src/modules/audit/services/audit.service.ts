import type { ClientSession } from 'mongoose';
import { AuditLogModel, type AuditAction } from '../models/audit-log.model.js';

export interface AuditEntry {
  actorId: string | null;
  action: AuditAction;
  targetType: 'user' | 'role';
  targetId: string;
  details?: Record<string, unknown>;
}

export type AuditRecorder = (entry: AuditEntry) => Promise<void>;

/** Pass the transaction session so the log entry commits or rolls back with the change. */
export async function recordAudit(entry: AuditEntry, session?: ClientSession): Promise<void> {
  await AuditLogModel.create(
    [
      {
        actor: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        details: entry.details ?? {},
      },
    ],
    { session },
  );
}

export async function listAudit({ page, limit }: { page: number; limit: number }) {
  const [items, total] = await Promise.all([
    AuditLogModel.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ actor: { _id: unknown; name: string; email: string } | null }>(
        'actor',
        'name email',
      )
      .lean(),
    AuditLogModel.countDocuments(),
  ]);
  return {
    items: items.map((e) => ({
      id: String(e._id),
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      details: e.details,
      actor: e.actor ? { id: String(e.actor._id), name: e.actor.name, email: e.actor.email } : null,
      createdAt: e.createdAt,
    })),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
