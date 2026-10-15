import { isValidObjectId, type Types } from 'mongoose';
import { SessionModel } from '../models/session.model.js';
import type { SessionRecord, SessionRepository, SessionStatus } from '../types/index.js';

interface SessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  status: SessionStatus;
  expiresAt: Date;
  familyStartedAt: Date;
  rotatedAt?: Date | null;
  userAgent?: string | null;
}

const toRecord = (d: SessionDoc): SessionRecord => ({
  id: d._id.toString(),
  userId: d.userId.toString(),
  familyId: d.familyId,
  tokenHash: d.tokenHash,
  status: d.status,
  expiresAt: d.expiresAt,
  familyStartedAt: d.familyStartedAt,
  rotatedAt: d.rotatedAt ?? null,
  userAgent: d.userAgent ?? null,
});

export class MongoSessionRepository implements SessionRepository {
  async create(input: Omit<SessionRecord, 'id'>): Promise<SessionRecord> {
    const doc = await SessionModel.create(input);
    return toRecord(doc.toObject() as SessionDoc);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const doc = await SessionModel.findOne({ tokenHash }).lean<SessionDoc>();
    return doc ? toRecord(doc) : null;
  }

  async findById(id: string): Promise<SessionRecord | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await SessionModel.findById(id).lean<SessionDoc>();
    return doc ? toRecord(doc) : null;
  }

  async markRotated(id: string, at: Date): Promise<boolean> {
    const result = await SessionModel.updateOne(
      { _id: id, status: 'active' },
      { $set: { status: 'rotated', rotatedAt: at } },
    );
    return result.modifiedCount === 1;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await SessionModel.updateMany(
      { familyId, status: { $ne: 'revoked' } },
      { $set: { status: 'revoked' } },
    );
  }

  async hasActiveInFamily(familyId: string, now: Date): Promise<boolean> {
    const found = await SessionModel.exists({ familyId, status: 'active', expiresAt: { $gt: now } });
    return found !== null;
  }
}