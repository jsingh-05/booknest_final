import express from "express";
import { postMessage, getMessages, deleteMessage } from "../controllers/chat.controller";
import authGuard, { requireAuth } from "../middleware/auth.middleware";
import { requireMembership, allowPublicView } from "../middleware/club.middleware";

const router = express.Router();

// message endpoints are under /api/clubs/:id/messages
router.post("/:id/messages", requireAuth, requireMembership, postMessage);
router.get("/:id/messages", allowPublicView, getMessages);
router.delete("/:id/messages/:messageId", requireAuth, deleteMessage);

export default router;
