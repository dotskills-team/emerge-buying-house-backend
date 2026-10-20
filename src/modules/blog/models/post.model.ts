import { Schema, model, type Types } from 'mongoose';

export const POST_STATUSES = ['draft', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export interface IPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: { url: string; publicId?: string; alt: string; blur?: string } | null;
  status: PostStatus;
  category: Types.ObjectId | null;
  tags: string[];
  author: Types.ObjectId;
  seoTitle: string;
  seoDescription: string;
  ogImage: string | null;
  /** Points search engines at the original when the article first appeared elsewhere. */
  canonicalUrl: string | null;
  /** Keeps the article out of search results while leaving it reachable by link. */
  noIndex: boolean;
  featured: boolean;
  readingTime: number;
  publishedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const coverImageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    alt: { type: String, default: '', maxlength: 200 },
    blur: { type: String },
  },
  { _id: false },
);

const postSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, default: '', maxlength: 300 },
    content: { type: String, default: '' },
    coverImage: { type: coverImageSchema, default: null },
    status: { type: String, enum: POST_STATUSES, default: 'draft' },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    tags: { type: [String], default: [] },
    // Must match the model name registered in modules/users/models/user.model.ts
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    seoTitle: { type: String, default: '', maxlength: 70 },
    seoDescription: { type: String, default: '', maxlength: 170 },
    ogImage: { type: String, default: null },
    canonicalUrl: { type: String, default: null },
    noIndex: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    readingTime: { type: Number, default: 1 },
    publishedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
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

postSchema.index({ status: 1, deletedAt: 1, publishedAt: -1 });
postSchema.index({ category: 1 });
postSchema.index({ tags: 1 });

export const PostModel = model<IPost>('Post', postSchema);
