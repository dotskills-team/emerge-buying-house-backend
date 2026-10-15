import { isValidObjectId, type Types } from 'mongoose';
import type { UserRecord, UserRepository } from '../../../core/auth/types/index.js';
import { UserModel } from '../../../core/auth/models/user.model.js';
// import { UserModel } from '../models/user.model.js';

interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
}

const toRecord = (d: UserDoc): UserRecord => ({
  id: d._id.toString(),
  name: d.name,
  email: d.email,
  passwordHash: d.passwordHash ?? '',
  isActive: d.isActive,
  failedLoginAttempts: d.failedLoginAttempts,
  lockedUntil: d.lockedUntil ?? null,
});

export class MongoUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ email }).select('+passwordHash').lean<UserDoc>();
    return doc ? toRecord(doc) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await UserModel.findById(id).select('+passwordHash').lean<UserDoc>();
    return doc ? toRecord(doc) : null;
  }

  async create(input: { name: string; email: string; passwordHash: string }): Promise<UserRecord> {
    const doc = await UserModel.create(input);
    return toRecord(doc.toObject() as UserDoc);
  }

  async incrementFailedAttempts(id: string): Promise<number> {
    const doc = await UserModel.findByIdAndUpdate(
      id,
      { $inc: { failedLoginAttempts: 1 } },
      { new: true },
    ).lean<UserDoc>();
    return doc?.failedLoginAttempts ?? 0;
  }

  async lock(id: string, until: Date): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $set: { lockedUntil: until, failedLoginAttempts: 0 } });
  }

  async recordSuccessfulLogin(id: string, at: Date): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      { $set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: at } },
    );
  }
}