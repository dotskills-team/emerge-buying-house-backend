import { Schema, model } from 'mongoose';

export interface IProductCategory {
  name: string;
  slug: string;
  description: string;
  /** Lower comes first on the website. */
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const productCategorySchema = new Schema<IProductCategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 300 },
    sortOrder: { type: Number, default: 0 },
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

productCategorySchema.index({ sortOrder: 1, name: 1 });

export const ProductCategoryModel = model<IProductCategory>(
  'ProductCategory',
  productCategorySchema,
);
