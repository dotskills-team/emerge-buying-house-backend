import { Schema, model, type Types } from 'mongoose';

export const UNANSWERED_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type UnansweredStatus = (typeof UNANSWERED_STATUSES)[number];

/**
 * A question the chatbot had no answer for. The same question (same meaningful words) is counted
 * on one record, so the team sees what visitors ask most.
 */
export interface IUnansweredQuestion {
  /** The question's meaningful words, sorted: what makes two questions "the same". */
  key: string;
  /** The wording of the most recent visitor who asked it. */
  text: string;
  count: number;
  lastAskedAt: Date;
  status: UnansweredStatus;
  /** The answer written for it, when resolved. */
  answer: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const unansweredSchema = new Schema<IUnansweredQuestion>(
  {
    key: { type: String, required: true, unique: true, maxlength: 600 },
    text: { type: String, required: true, maxlength: 500 },
    count: { type: Number, default: 1 },
    lastAskedAt: { type: Date, required: true },
    status: { type: String, enum: UNANSWERED_STATUSES, default: 'open' },
    answer: { type: Schema.Types.ObjectId, ref: 'ChatAnswer', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

unansweredSchema.index({ status: 1, count: -1, lastAskedAt: -1 });

export const UnansweredQuestionModel = model<IUnansweredQuestion>(
  'UnansweredQuestion',
  unansweredSchema,
);
