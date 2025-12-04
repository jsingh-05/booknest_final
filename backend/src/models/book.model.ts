import { Schema, model, Document } from "mongoose";

export interface IBook extends Document {
  title: string;
  authors: string[];
  isbn?: string;
  description?: string;
  tags: string[];   // genres, themes
  pageCount?: number;
  publishedAt?: Date;
  coverUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const BookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true, text: true },
    authors: [{ type: String }],
    isbn: { type: String, required: false },
    description: { type: String },
    tags: [{ type: String, index: true }],
    coverUrl: String,
    pageCount: Number,
    publishedAt: Date,
  },
  { timestamps: true }
);

// text index for search
BookSchema.index({ title: "text", description: "text", authors: "text" });

export const BookModel = model<IBook>("Book", BookSchema);