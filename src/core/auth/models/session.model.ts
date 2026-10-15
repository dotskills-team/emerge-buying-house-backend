import { Schema, model } from 'mongoose';

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['active', 'rotated', 'revoked'], default: 'active' },
    expiresAt: { type: Date, required: true },
    familyStartedAt: { type: Date, required: true },
    rotatedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);

// Expired sessions are deleted a day after expiry (kept briefly so token reuse is still detected).
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const SessionModel = model('Session', sessionSchema);