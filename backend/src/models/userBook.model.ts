import { Schema, model, Document, Types } from "mongoose";

export interface IUserBook extends Document {
  userId: Types.ObjectId;
  bookId: Types.ObjectId;
  status: "reading" | "completed" | "planned" | "paused" | "dnf";
  startedAt?: Date;
  completedAt?: Date;
  dnfAt?: Date;
  totalPagesRead: number;
  dailyGoal?: number; // optional user-set daily pages goal
  rating?: number;    // user rating after completion
  tags?: string[];    // user assigned tags, e.g. ["horror", "spooky"]
  createdAt: Date;
  updatedAt: Date;
}

const UserBookSchema = new Schema<IUserBook>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    status: { type: String, enum: ["reading", "completed", "planned", "paused", "dnf"], default: "planned" },
    startedAt: Date,
    completedAt: Date,
    dnfAt: Date,
    totalPagesRead: { type: Number, default: 0 },
    dailyGoal: Number,
    rating: Number,
    tags: [{ type: String }],
  },
  { timestamps: true }
);

// ensure unique per user+book
UserBookSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export const UserBookModel = model<IUserBook>("UserBook", UserBookSchema);
