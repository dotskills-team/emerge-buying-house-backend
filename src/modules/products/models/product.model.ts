import { Schema, model, type Types } from 'mongoose';

export const PRODUCT_STATUSES = ['draft', 'published'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface ProductImage {
  url: string;
  publicId?: string;
  alt: string;
  width?: number;
  height?: number;
  /** Tiny inline preview shown blurred while the photo loads. */
  blur?: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

/**
 * A catalogue item as a garment buyer evaluates it: what it is, what it is made of, how it can be
 * ordered (MOQ, sizes, colours, lead time) and which standards it meets. The first image is the
 * cover.
 */
export interface IProduct {
  name: string;
  slug: string;
  styleCode: string;
  category: Types.ObjectId | null;
  summary: string;
  description: string;
  images: ProductImage[];
  fabric: string;
  weight: string;
  sizes: string[];
  colors: string[];
  moq: number | null;
  moqUnit: string;
  leadTime: string;
  certifications: string[];
  specs: ProductSpec[];
  tags: string[];
  status: ProductStatus;
  featured: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  publishedAt: Date | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<ProductImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    alt: { type: String, default: '', maxlength: 200 },
    width: { type: Number },
    height: { type: Number },
    blur: { type: String },
  },
  { _id: false },
);

const specSchema = new Schema<ProductSpec>(
  {
    label: { type: String, required: true, maxlength: 40 },
    value: { type: String, required: true, maxlength: 160 },
  },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    styleCode: { type: String, default: '', trim: true, maxlength: 40 },
    category: { type: Schema.Types.ObjectId, ref: 'ProductCategory', default: null },
    summary: { type: String, default: '', maxlength: 300 },
    description: { type: String, default: '' },
    images: { type: [imageSchema], default: [] },
    fabric: { type: String, default: '', maxlength: 160 },
    weight: { type: String, default: '', maxlength: 40 },
    sizes: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    moq: { type: Number, default: null, min: 0 },
    moqUnit: { type: String, default: 'pcs per style', maxlength: 40 },
    leadTime: { type: String, default: '', maxlength: 60 },
    certifications: { type: [String], default: [] },
    specs: { type: [specSchema], default: [] },
    tags: { type: [String], default: [] },
    status: { type: String, enum: PRODUCT_STATUSES, default: 'draft' },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    seoTitle: { type: String, default: '', maxlength: 70 },
    seoDescription: { type: String, default: '', maxlength: 170 },
    publishedAt: { type: Date, default: null },
    // Must match the model name registered in modules/users/models/user.model.ts
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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

productSchema.index({ status: 1, deletedAt: 1, sortOrder: 1, publishedAt: -1 });
productSchema.index({ category: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ tags: 1 });

export const ProductModel = model<IProduct>('Product', productSchema);
