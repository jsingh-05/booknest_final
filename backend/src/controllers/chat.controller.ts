import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware";
import { MessageModel } from "../models/message.model";
import { ClubModel } from "../models/club.model";

/**
 * POST /api/clubs/:id/messages
 */
export const postMessage = async (req: AuthRequest, res: Response) => {
  try {
    const clubId = String(req.params.id || "");
    const user = req.user;
    const content = (req.body?.content || "").trim();
    const parentId = (req.body?.parentId || "").trim();

    if (!content) return res.status(400).json({ message: "Message required" });
    if (content.length > 2000) return res.status(400).json({ message: "Message too long" });

    if (!clubId) return res.status(400).json({ message: "Invalid club id" });
    if (!mongoose.Types.ObjectId.isValid(clubId)) return res.status(400).json({ message: "Invalid club id" });
    const clubExists = await ClubModel.exists({ _id: new mongoose.Types.ObjectId(clubId) });
    if (!clubExists) return res.status(404).json({ message: "Club not found" });

    let parent: any = null;
    if (parentId) {
      if (!mongoose.Types.ObjectId.isValid(parentId)) return res.status(400).json({ message: "Invalid parent id" });
      parent = await MessageModel.findById(parentId).lean();
      if (!parent || String(parent.clubId) !== String(clubId)) return res.status(400).json({ message: "Parent not found in this club" });
    }

    const toCreate: any = {
      clubId: new mongoose.Types.ObjectId(clubId),
      senderId: new mongoose.Types.ObjectId(user!._id),
      body: content,
    };
    if (parentId) toCreate.parentId = new mongoose.Types.ObjectId(parentId);
    const message = (await MessageModel.create(toCreate)) as any;
    const populated = await MessageModel.findById(message._id).populate({ path: "senderId", select: "username" });
    return res.status(201).json(populated);
  } catch (err) {
    console.error("postMessage err", err);
    return res.status(500).json({ message: "Failed to post message" });
  }
};

/**
 * GET /api/clubs/:id/messages?limit=50&before=<messageId>
 */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const clubId = String(req.params.id || "");
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const before = req.query.before as string | undefined;

    if (!clubId) return res.status(400).json({ message: "Invalid club id" });
    if (!mongoose.Types.ObjectId.isValid(clubId)) return res.status(400).json({ message: "Invalid club id" });

    const filter: any = { clubId: new mongoose.Types.ObjectId(clubId) };
    if (before) {
      if (!mongoose.Types.ObjectId.isValid(before)) return res.status(400).json({ message: "Invalid before id" });
      const beforeMsg = await MessageModel.findById(before).select("createdAt");
      if (!beforeMsg) return res.status(400).json({ message: "Invalid before id" });
      filter.createdAt = { $lt: beforeMsg.createdAt };
    }

    const parentsFilter = { ...filter, $or: [{ parentId: null }, { parentId: { $exists: false } }] } as any;
    const parents = await MessageModel.find(parentsFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "senderId", select: "username" })
      .lean();
    const parentIds = parents.map((m: any) => m._id);
    const children = await MessageModel.find({ clubId: new mongoose.Types.ObjectId(clubId), parentId: { $in: parentIds } })
      .sort({ createdAt: 1 })
      .populate({ path: "senderId", select: "username" })
      .lean();
    const grouped = parents.reverse().map((p: any) => ({
      _id: String(p._id),
      clubId: String(p.clubId),
      senderId: p.senderId,
      body: p.deleted ? "[deleted]" : p.body,
      deleted: Boolean(p.deleted),
      createdAt: p.createdAt,
      replies: children
        .filter((c: any) => String(c.parentId) === String(p._id))
        .map((c: any) => ({
          _id: String(c._id),
          clubId: String(c.clubId),
          senderId: c.senderId,
          body: c.deleted ? "[deleted]" : c.body,
          deleted: Boolean(c.deleted),
          createdAt: c.createdAt,
        })),
    }));
    return res.json(grouped);
  } catch (err) {
    console.error("getMessages err", err);
    return res.status(500).json({ message: "Failed to load messages" });
  }
};

/**
 * DELETE /api/clubs/:id/messages/:messageId
 * Soft-delete: only author or admin can delete; keep thread
 */
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const clubId = String(req.params.id || "");
    const messageId = String(req.params.messageId || "");
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (!clubId || !mongoose.Types.ObjectId.isValid(clubId)) return res.status(400).json({ message: "Invalid club id" });
    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) return res.status(400).json({ message: "Invalid message id" });

    const msg = await MessageModel.findById(messageId).lean();
    if (!msg || String(msg.clubId) !== String(clubId)) return res.status(404).json({ message: "Message not found" });

    const isOwner = String(msg.senderId) === String(user._id);
    const isAdmin = Array.isArray(user.roles) && user.roles.includes("admin");
    if (!isOwner && !isAdmin) return res.status(403).json({ message: "Not allowed" });

    await MessageModel.findByIdAndUpdate(messageId, { $set: { deleted: true, deletedAt: new Date(), body: "" } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("deleteMessage err", err);
    return res.status(500).json({ message: "Failed to delete message" });
  }
};
