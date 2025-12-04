import { Schema, model, Document, Types } from "mongoose";

export interface IClub extends Document {
  name: string;
  description?: string;
  isPublic: boolean;
  tags?: string[];
  leaderId?: Types.ObjectId | null;
  currentBook?: {
    title?: string;
    authors?: string[];
    coverUrl?: string;
    totalPages?: number;
  } | null;
  schedule?: string;
  readingSchedule?: {
    _id?: Types.ObjectId;
    title: string;
    order?: number;
    dueDate?: Date;
    completed?: boolean;
  }[];
  theme?: {
    title?: string;
    startsAt?: Date;
    expiresAt?: Date;
  } | null;
  memberCount: number;
  starterClub?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CurrentBookSchema = new Schema({
  title: String,
  authors: [String],
  coverUrl: String,
  totalPages: Number,
}, { _id: false });

const ThemeSchema = new Schema({
  title: String,
  startsAt: Date,
  expiresAt: Date,
}, { _id: false });

const ClubSchema = new Schema<IClub>(
  {
    name: { type: String, required: true, index: true },
    description: { type: String },
    isPublic: { type: Boolean, default: true, index: true },
    tags: [{ type: String }],
    leaderId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    currentBook: { type: CurrentBookSchema, default: null },
    schedule: { type: String, default: null },
    readingSchedule: [
      new Schema(
        {
          title: { type: String, required: true },
          order: { type: Number, default: 0 },
          dueDate: { type: Date },
          completed: { type: Boolean, default: false },
        },
        { _id: true }
      ),
    ],
    theme: { type: ThemeSchema, default: null },
    memberCount: { type: Number, default: 0 },
    starterClub: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

ClubSchema.index({ isPublic: 1, tags: 1, name: 1 });

export const ClubModel = model<IClub>("Club", ClubSchema);
