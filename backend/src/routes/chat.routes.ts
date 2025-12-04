import express from "express";
import { postMessage, getMessages, deleteMessage, editMessage } from "../controllers/chat.controller";
import authGuard, { requireAuth, optionalAuth } from "../middleware/auth.middleware";
import { requireMembership, allowPublicView } from "../middleware/club.middleware";

const router = express.Router();

// message endpoints are under /api/clubs/:id/messages
router.post("/:id/messages", requireAuth, requireMembership, postMessage);
router.get("/:id/messages", optionalAuth, allowPublicView, getMessages);
router.delete("/:id/messages/:messageId", requireAuth, deleteMessage);
router.patch("/:id/messages/:messageId", requireAuth, editMessage);

export default router;
