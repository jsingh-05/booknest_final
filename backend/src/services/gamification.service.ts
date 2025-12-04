import { Types } from "mongoose";
import { UserModel, IUser } from "../models/user.model";
import { ReadingSessionModel } from "../models/readingSession.model";
import { UserBookModel } from "../models/userBook.model";
import { BookModel } from "../models/book.model";

type Range = "week" | "month" | "all";

function startDateForRange(range: Range) {
  const now = new Date();
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

function toDateString(d: Date) {
  return d.toISOString().split("T")[0];
}

export async function getUserStatsDetailed(userId: string) {
  const user = await UserModel.findById(userId).exec();
  if (!user) throw new Error("User not found");

  const stats = {
    stats: user.stats,
    streak: user.streak,
    preferences: user.preferences,
  };

  return stats;
}

export async function getLeaderboard(range: Range = "all", limit = 50) {
  const start = startDateForRange(range);

  let sessionMatch: any = {};
  if (start) {
    sessionMatch.date = { $gte: toDateString(start) };
  }

  const sessionsAgg = await ReadingSessionModel.aggregate([
    { $match: sessionMatch },
    { $group: { _id: "$userId", pages: { $sum: "$pages" } } },
  ]).exec();

  let completedAgg: { _id: Types.ObjectId; completed: number }[] = [];
  let dnfAgg: { _id: Types.ObjectId; dnf: number }[] = [];
  if (range === "all") {
    completedAgg = await UserBookModel.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: "$userId", completed: { $sum: 1 } } },
    ]).exec();
    dnfAgg = await UserBookModel.aggregate([
      { $match: { status: "dnf" } },
      { $group: { _id: "$userId", dnf: { $sum: 1 } } },
    ]).exec();
  } else {
    completedAgg = await UserBookModel.aggregate([
      { $match: { status: "completed", completedAt: { $gte: start! } } },
      { $group: { _id: "$userId", completed: { $sum: 1 } } },
    ]).exec();
    dnfAgg = await UserBookModel.aggregate([
      { $match: { status: "dnf", dnfAt: { $gte: start! } } },
      { $group: { _id: "$userId", dnf: { $sum: 1 } } },
    ]).exec();
  }

  const pagesByUser = new Map<string, number>();
  sessionsAgg.forEach((s) => pagesByUser.set(String(s._id), s.pages || 0));

  const completedByUser = new Map<string, number>();
  completedAgg.forEach((c) => completedByUser.set(String(c._id), c.completed || 0));
  const dnfByUser = new Map<string, number>();
  dnfAgg.forEach((d) => dnfByUser.set(String(d._id), d.dnf || 0));

  const userIds = Array.from(new Set([
    ...Array.from(pagesByUser.keys()),
    ...Array.from(completedByUser.keys()),
  ]));

  const users = await UserModel.find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } }).exec();

  const rows = users.map((u) => {
    const id = String(u._id);
    const pages = pagesByUser.get(id) || 0;
    const completed = completedByUser.get(id) || 0;
    const dnfCount = dnfByUser.get(id) || 0;
    const score = pages + ((u.streak?.current || 0) * 10) + (completed * 50) - (dnfCount * 20);
    return {
      userId: id,
      username: u.username,
      pages,
      completed,
      streak: u.streak,
      score,
    };
  });

  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}

// badges removed
