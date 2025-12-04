import { Router } from "express";
import authGuard from "../middleware/auth.middleware";
import { getStats, leaderboard, updateDailyGoal, updateMe } from "../controllers/user.controller";

const router = Router();

router.get("/:id/stats", authGuard, getStats);
router.get("/leaderboard", leaderboard);
router.patch("/me/goal", authGuard, updateDailyGoal);
router.patch("/me", authGuard, updateMe);

export default router;
