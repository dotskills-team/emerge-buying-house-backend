import { Schema, model, type Types } from 'mongoose';

export const INQUIRY_TOPICS = ['quote', 'partnership', 'audit', 'careers', 'other'] as const;
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];

export const TOPIC_LABELS: Record<InquiryTopic, string> = {
  quote: 'Request a quote',
  partnership: 'Partnership',
  audit: 'Factory audit',
  careers: 'Careers',
  other: 'Other',
};

/**
 * new: nobody has opened it yet. open: being handled. replied: answered from the dashboard.
 * closed: done, kept for the record.
 */
export const INQUIRY_STATUSES = ['new', 'open', 'replied', 'closed'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

/** What happened to an automatic email: sent, failed, or skipped because email is not set up. */
export const DELIVERY_STATES = ['sent', 'failed', 'skipped'] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export interface InquiryReply {
  message: string;
  sentBy: Types.ObjectId | null;
  sentAt: Date;
}

/** A message sent through the website's contact form. */
export interface IInquiry {
  /** Short code quoted to the visitor and in every email, e.g. EBH-261020-7K3Q. */
  reference: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  country: string;
  topic: InquiryTopic;
  /** The product a "Request a quote" button pre-filled, if any. */
  product: string;
  message: string;
  status: InquiryStatus;
  /** Internal note for the team; never shown to the visitor. */
  note: string;
  replies: InquiryReply[];
  notifications: { team: DeliveryState; visitor: DeliveryState };
  createdAt: Date;
  updatedAt: Date;
}

const replySchema = new Schema<InquiryReply>(
  {
    message: { type: String, required: true, maxlength: 10_000 },
    // Must match the model name registered in modules/users/models/user.model.ts
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sentAt: { type: Date, required: true },
  },
  { _id: false },
);

const inquirySchema = new Schema<IInquiry>(
  {
    reference: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, maxlength: 254 },
    company: { type: String, default: '', maxlength: 120 },
    phone: { type: String, default: '', maxlength: 40 },
    country: { type: String, default: '', maxlength: 80 },
    topic: { type: String, enum: INQUIRY_TOPICS, required: true },
    product: { type: String, default: '', maxlength: 140 },
    message: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: INQUIRY_STATUSES, default: 'new' },
    note: { type: String, default: '', maxlength: 2000 },
    replies: { type: [replySchema], default: [] },
    notifications: {
      team: { type: String, enum: DELIVERY_STATES, default: 'skipped' },
      visitor: { type: String, enum: DELIVERY_STATES, default: 'skipped' },
    },
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

inquirySchema.index({ status: 1, createdAt: -1 });
inquirySchema.index({ createdAt: -1 });

export const InquiryModel = model<IInquiry>('Inquiry', inquirySchema);
