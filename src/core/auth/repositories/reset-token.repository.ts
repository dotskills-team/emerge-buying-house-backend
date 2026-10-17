import { isValidObjectId, type Types } from 'mongoose';
import { ResetTokenModel } from '../models/reset-token.model.js';
import type { ResetTokenRecord, ResetTokenRepository } from '../types/index.js';

interface ResetTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
}

const toRecord = (d: ResetTokenDoc): ResetTokenRecord => ({
  id: d._id.toString(),
  userId: d.userId.toString(),
  tokenHash: d.tokenHash,
  expiresAt: d.expiresAt,
  usedAt: d.usedAt ?? null,
});

export class MongoResetTokenRepository implements ResetTokenRepository {
  async create(input: Omit<ResetTokenRecord, 'id' | 'usedAt'>): Promise<ResetTokenRecord> {
    const doc = await ResetTokenModel.create(input);
    return toRecord(doc.toObject());
  }

  async findByTokenHash(tokenHash: string): Promise<ResetTokenRecord | null> {
    const doc = await ResetTokenModel.findOne({ tokenHash }).lean<ResetTokenDoc>();
    return doc ? toRecord(doc) : null;
  }

  async consume(id: string, at: Date): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const result = await ResetTokenModel.updateOne(
      { _id: id, usedAt: null },
      { $set: { usedAt: at } },
    );
    return result.modifiedCount === 1;
  }

  async invalidateForUser(userId: string, at: Date): Promise<void> {
    await ResetTokenModel.updateMany({ userId, usedAt: null }, { $set: { usedAt: at } });
  }
}
