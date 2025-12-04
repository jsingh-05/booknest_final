import { Request, Response } from "express";
import { getUserStatsDetailed, getLeaderboard } from "../services/gamification.service";
import { UserModel } from "../models/user.model";

function isSelfOrAdmin(req: Request, userIdParam: string) {
  const me = (req as any).user;
  if (!me) return false;
  if (me.id === userIdParam) return true;
  const roles = Array.isArray(me.roles) ? me.roles : [];
  return roles.includes("admin");
}

export async function getStats(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ message: "User id is required" });
    }
    if (!isSelfOrAdmin(req, id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const stats = await getUserStatsDetailed(id);
    return res.json(stats);
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to fetch user stats" });
  }
}

export async function leaderboard(req: Request, res: Response) {
  try {
    const range = (req.query.range as any) || "all";
    const data = await getLeaderboard(range);
    return res.json({ range, data });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to fetch leaderboard" });
  }
}

export async function updateDailyGoal(req: Request, res: Response) {
  try {
    const me = (req as any).user;
    if (!me?.id) return res.status(401).json({ message: "Unauthorized" });
    const { dailyGoal } = req.body || {};
    const n = Number(dailyGoal);
    if (!Number.isFinite(n) || n <= 0 || n > 10000) {
      return res.status(400).json({ message: "dailyGoal must be a positive number <= 10000" });
    }
    const user = await UserModel.findById(me.id).exec();
    if (!user) return res.status(404).json({ message: "User not found" });
    user.stats.dailyGoal = n;
    await user.save();
    return res.json({ dailyGoal: user.stats.dailyGoal });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to update goal" });
  }
}

export async function updateMe(req: Request, res: Response) {
  try {
    const me = (req as any).user;
    if (!me?.id) return res.status(401).json({ message: "Unauthorized" });
    const { username, email, preferences, dislikes, yearGoal } = req.body || {};

    const user = await UserModel.findById(me.id).exec();
    if (!user) return res.status(404).json({ message: "User not found" });

    if (typeof username === "string" && username.trim()) {
      const exists = await UserModel.findOne({ username: username.trim(), _id: { $ne: user._id } }).exec();
      if (exists) return res.status(409).json({ message: "Username already taken" });
      user.username = username.trim();
    }
    if (typeof email === "string" && email.trim()) {
      const existsE = await UserModel.findOne({ email: email.trim(), _id: { $ne: user._id } }).exec();
      if (existsE) return res.status(409).json({ message: "Email already in use" });
      user.email = email.trim();
    }
    if (Array.isArray(preferences)) {
      const now = new Date();
      const cleaned = Array.from(new Set(
        preferences
          .map((t: any) => String(t || "").trim().toLowerCase())
          .filter((t: string) => t.length > 0)
          .map((t: string) => t.replace(/[^a-z0-9\-\s]/g, ""))
          .map((t: string) => t.replace(/\s+/g, "-"))
          .slice(0, 100)
      ));
      const dislikedGenres = new Set((user.dislikes || []).map((d: any) => String(d?.tag || "").toLowerCase()));
      const filtered = cleaned.filter((g) => !dislikedGenres.has(g));
      user.preferences = filtered.map((g: string) => ({ genre: g, weight: 0.8, lastUpdated: now }));
    }

    if (Array.isArray(dislikes)) {
      const cleaned = Array.from(new Set(
        dislikes
          .map((t: any) => String(t || "").trim().toLowerCase())
          .filter((t: string) => t.length > 0)
          .map((t: string) => t.replace(/[^a-z0-9\-\s]/g, ""))
          .map((t: string) => t.replace(/\s+/g, "-"))
          .slice(0, 100)
      ));
      const now = new Date();
      user.dislikes = cleaned.map((tag) => ({ tag, weight: 0.1, lastUpdated: now }));
      if (Array.isArray(user.preferences)) {
        const dislikedSet = new Set(cleaned.map((x) => String(x).toLowerCase()));
        user.preferences = user.preferences.filter((p: any) => !dislikedSet.has(String(p?.genre || "").toLowerCase()));
      }
    }

    const yg = Number(yearGoal);
    if (Number.isFinite(yg) && yg > 0 && yg <= 10000) {
      user.stats.yearGoal = yg;
    }

    await user.save();
    return res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        preferences: user.preferences,
        dislikes: user.dislikes,
        stats: user.stats,
        streak: user.streak,
        roles: user.roles,
        createdAt: user.createdAt,
      }
    });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || "Failed to update profile" });
  }
}
