import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { recommendForUser } from "../services/recommender.service";
import authGuard, { requireAuth } from "../middleware/auth.middleware";

const router = Router();

const hits = new Map<string, { count: number; resetAt: number }>();
function limit(req: Request, res: Response, next: NextFunction) {
  const uid = String((req as any).user?._id || (req.query as any)?.userId || (req.params as any)?.userId || "");
  const key = uid ? `user:${uid}` : (req.ip || "anon");
  const now = Date.now();
  const windowMs = 60_000;
  const max = 10;
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }
  if (entry.count >= max) {
    const retry = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));
    return res.status(429).json({ message: `Too many requests. Try again in ${retry}s` });
  }
  entry.count += 1;
  return next();
}

router.get("/user/:userId", requireAuth, limit, async (req, res) => {
  try {
    const userId = String(req.params.userId);
    const items = await recommendForUser(userId, 12);
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || "Failed to recommend" });
  }
});

router.get("/", requireAuth, limit, async (req, res) => {
  try {
    const userId = String((req as any).user?._id || req.query.userId || "");
    if (!userId) return res.status(400).json({ message: "userId required" });
    const items = await recommendForUser(userId, 12);
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || "Failed to recommend" });
  }
});

export default router;

