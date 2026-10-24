import { Schema, model, type Types } from 'mongoose';

/** One question the chatbot can answer, written by the team. Only published answers are used. */
export interface IChatAnswer {
  question: string;
  answer: string;
  /** Other words visitors may use for the same thing ("MOQ", "lead time"). */
  keywords: string[];
  published: boolean;
  /** Lower comes first among the suggested questions. */
  sortOrder: number;
  /** How often it was given to a visitor. */
  hits: number;
  helpful: number;
  notHelpful: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const chatAnswerSchema = new Schema<IChatAnswer>(
  {
    question: { type: String, required: true, trim: true, maxlength: 200 },
    answer: { type: String, required: true, maxlength: 2000 },
    keywords: { type: [String], default: [] },
    published: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    hits: { type: Number, default: 0 },
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 },
    // Must match the model name registered in modules/users/models/user.model.ts
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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

chatAnswerSchema.index({ published: 1, sortOrder: 1 });

export const ChatAnswerModel = model<IChatAnswer>('ChatAnswer', chatAnswerSchema);
