// models/User.ts
import { Schema, model, Document, Types } from "mongoose";

export type Genre = string;

export interface IPreference {
  genre: Genre;
  weight: number;
  lastUpdated: Date;
}

export interface IDislike {
  tag: string;
  weight: number;
  lastUpdated: Date;
}

export interface IBadge {
  code: string;
  awardedAt: Date;
}

export interface IStreak {
  current: number;
  lastReadAt?: Date;
  best: number;
}

export interface IStats {
  totalPages: number;
  totalBooksCompleted: number;
  distinctGenresCount?: number;
  lastActiveAt?: Date;
  score?: number;
  dailyGoal?: number;
  yearGoal?: number;
}

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  preferences: IPreference[];
  dislikes: IDislike[];
  roles: string[];
  badges: IBadge[];
  streak: IStreak;
  stats: IStats;
  currentBooks?: Types.ObjectId[]; // refs to UserBook
  createdAt: Date;
  updatedAt: Date;

  // instance helpers
  touchRead?(pages: number, genres?: Genre[]): Promise<void>;
}

const PreferenceSchema = new Schema<IPreference>(
  {
    genre: {
      type: String,
      required: true,
    },
    weight: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },

    // richer preference objects
    preferences: { type: [PreferenceSchema], default: [] },
    // explicit dislikes (free-form tags with weights)
    dislikes: {
      type: [new Schema<IDislike>({
        tag: { type: String, required: true },
        weight: { type: Number, min: 0, max: 1, default: 0.1 },
        lastUpdated: { type: Date, default: Date.now },
      }, { _id: false })],
      default: [],
    },

    // authorization
    roles: { type: [String], default: ["user"] },

    // badges / achievements
    badges: [
      {
        code: { type: String },
        awardedAt: { type: Date, default: Date.now },
      },
    ],

    // streak object (daily reading consistency)
    streak: {
      current: { type: Number, default: 0 },
      lastReadAt: Date,
      best: { type: Number, default: 0 },
    },

    // cached stats used for leaderboards / quick reads
    stats: {
      totalPages: { type: Number, default: 0 },
      totalBooksCompleted: { type: Number, default: 0 },
      distinctGenresCount: { type: Number, default: 0 },
      lastActiveAt: Date,
      score: { type: Number, default: 0 },
      dailyGoal: { type: Number, default: 30 },
      yearGoal: { type: Number, default: 52 },
    },

    // refs to a separate user-book collection (keeps user doc small)
    currentBooks: [{ type: Schema.Types.ObjectId, ref: "UserBook" }],
  },
  { timestamps: true }
);


// fast leaderboard sort by score (descending)
UserSchema.index({ "stats.score": -1 });

// fast lookup for genre-based queries (multikey index)
UserSchema.index({ "preferences.genre": 1 });
// optional index for dislikes
UserSchema.index({ "dislikes.tag": 1 });

// support queries that find recently active users
UserSchema.index({ "stats.lastActiveAt": -1 });

/* -------------------------
   Instance / static helpers
   ------------------------- */

/**
 * Example: update streak and stats when user reads pages.
 * - increments pages, possibly increments streak if read on consecutive day
 * - updates lastActiveAt and score
 */
UserSchema.methods.touchRead = async function (this: IUser, pages: number, genres?: Genre[]) {
  const now = new Date();

  // update pages
  this.stats.totalPages = (this.stats.totalPages || 0) + (pages || 0);
  this.stats.lastActiveAt = now;
  // increment booksCompleted is done elsewhere when a book is marked complete

  // update streak: if lastReadAt is yesterday -> increment, if today do nothing, else reset to 1
  const last = this.streak.lastReadAt;
  if (!last) {
    this.streak.current = 1;
    this.streak.lastReadAt = now;
    this.streak.best = Math.max(this.streak.best || 0, this.streak.current);
  } else {
    const lastDate = new Date(last);
    const daysDiff = Math.floor((stripTime(now).getTime() - stripTime(lastDate).getTime()) / (24 * 60 * 60 * 1000));
    if (daysDiff === 0) {
      // already read today -> no change
    } else if (daysDiff === 1) {
      this.streak.current = (this.streak.current || 0) + 1;
      this.streak.lastReadAt = now;
      this.streak.best = Math.max(this.streak.best || 0, this.streak.current);
    } else {
      this.streak.current = 1;
      this.streak.lastReadAt = now;
    }
  }

  // quick example: score = pages + (streak * 10) + (booksCompleted * 50)
  this.stats.score = (this.stats.totalPages || 0) + ((this.streak.current || 0) * 10) + ((this.stats.totalBooksCompleted || 0) * 50);

  // update distinctGenresCount if genres list provided
  if (Array.isArray(genres) && genres.length) {
    const existingGenres = new Set((this.preferences || []).map((p) => p.genre));
    genres.forEach((g) => existingGenres.add(g));
    this.stats.distinctGenresCount = existingGenres.size;
  }

  await this.save();
};

// helper to strip time part of a Date (used above)
function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/* -------------------------
   Model
   ------------------------- */
export const UserModel = model<IUser>("User", UserSchema);
export default UserModel;
