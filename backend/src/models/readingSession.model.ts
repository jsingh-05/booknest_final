import { Schema, model, Document, Types } from "mongoose";

export interface IReadingSession extends Document {
  userId: Types.ObjectId;
  userBookId?: Types.ObjectId;  // optional, if linked to a userBook
  bookId?: Types.ObjectId;      // optional raw book ref
  date: string;                 // YYYY-MM-DD to aggregate easily
  pages: number;                // pages read this session/day
  durationMinutes?: number;     // optional
  createdAt: Date;
}

const ReadingSessionSchema = new Schema<IReadingSession>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  userBookId: { type: Schema.Types.ObjectId, ref: "UserBook" },
  bookId: { type: Schema.Types.ObjectId, ref: "Book" },
  date: { type: String, required: true, index: true }, // normalized date string
  pages: { type: Number, required: true },
  durationMinutes: Number,
}, { timestamps: true });

// Common queries: by user & date range
ReadingSessionSchema.index({ userId: 1, date: -1 });

export const ReadingSessionModel = model<IReadingSession>("ReadingSession", ReadingSessionSchema);