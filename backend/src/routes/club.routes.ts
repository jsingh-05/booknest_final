import express from "express";
import {
  createClub,
  listClubs,
  getClub,
  joinClub,
  createInvite,
  acceptInvite,
  setTheme,
  setCurrentBook,
  listInvites,
  listPublicClubs,
  listMembers,
  addScheduleItem,
  toggleScheduleItem,
  deleteScheduleItem,
} from "../controllers/club.controller";
import authGuard, { requireAuth } from "../middleware/auth.middleware";
import { requireClubLeader, requireMembership } from "../middleware/club.middleware";

const router = express.Router();

router.post("/", requireAuth, createClub); // any authenticated user
router.get("/", requireAuth, listClubs);
router.get("/public", listPublicClubs);
router.get("/invites", requireAuth, listInvites);
router.get("/:id", requireAuth, getClub);
router.post("/:id/join", requireAuth, joinClub);
router.get("/:id/members", requireAuth, requireMembership, listMembers);

// invites (leader-only)
router.post("/:id/invite", requireAuth, requireClubLeader, createInvite);
router.post("/:id/accept-invite", requireAuth, acceptInvite);

// leader actions
router.post("/:id/theme", requireAuth, requireClubLeader, setTheme);
router.post("/:id/current-book", requireAuth, requireClubLeader, setCurrentBook);
router.post("/:id/schedule", requireAuth, requireClubLeader, addScheduleItem);
router.patch("/:id/schedule/:itemId", requireAuth, requireClubLeader, toggleScheduleItem);
router.delete("/:id/schedule/:itemId", requireAuth, requireClubLeader, deleteScheduleItem);

export default router;
