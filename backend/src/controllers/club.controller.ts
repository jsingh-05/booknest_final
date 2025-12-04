import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { ClubModel } from "../models/club.model";
import { ClubMembershipModel } from "../models/clubMembership.model";
import { ClubInviteModel } from "../models/clubInvite.model";
import { UserModel } from "../models/user.model";

/**
 * Create club - allow authenticated users to create clubs.
 * Creator becomes leader and membership row is created.
 */
export const createClub = async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (!user || !user._id) return res.status(401).json({ message: "Authentication required" });

    const { name, description, isPublic = true, tags = [], schedule } = req.body || {};
    if (!name || name.trim().length < 3) return res.status(400).json({ message: "Name required (min 3 chars)" });

    const existing = await ClubModel.findOne({ name: name.trim() });
    if (existing) return res.status(409).json({ message: "Club name already exists" });

    const club = await ClubModel.create({
      name: name.trim(),
      description: description?.trim(),
      isPublic,
      tags,
      leaderId: user._id,
      schedule: schedule || null,
      memberCount: 0,
    });

    await ClubMembershipModel.create({
      clubId: club._id,
      userId: user._id,
      role: "leader",
      joinedAt: new Date(),
      active: true,
    });

    await ClubModel.findByIdAndUpdate(club._id, { $inc: { memberCount: 1 } });

    return res.status(201).json({ message: "Club created", club });
  } catch (err) {
    console.error("createClub err", err);
    return res.status(500).json({ message: "Failed to create club" });
  }
};

/**
 * List clubs — public clubs and those the user belongs to.
 * Supports: ?q=search & ?tag=TagName & ?page=1&limit=12
 */
export const listClubs = async (req: any, res: Response) => {
  try {
    const userId = req.user?._id;
    const q = (req.query.q as string) || "";
    const tag = (req.query.tag as string) || "";
    const scope = String(req.query.scope || "").toLowerCase();
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Number(req.query.limit || 12), 100);
    const skip = (page - 1) * limit;

    // clubs the user is a member of
    let memberClubIds: mongoose.Types.ObjectId[] = [];
    if (userId) {
      const memberships = await ClubMembershipModel.find({ userId, active: true }).select("clubId");
      memberClubIds = memberships.map(m => m.clubId as mongoose.Types.ObjectId);
    }

    let filters: any;
    if (scope === "explore") {
      filters = { isPublic: true };
    } else if (scope === "mine") {
      filters = { _id: { $in: memberClubIds.length ? memberClubIds : [new mongoose.Types.ObjectId()] } };
    } else {
      filters = { $or: [{ isPublic: true }] };
      if (memberClubIds.length) filters.$or.push({ _id: { $in: memberClubIds } });
    }

    if (q) filters.name = { $regex: q, $options: "i" };
    if (tag) filters.tags = tag;

    const [items, total] = await Promise.all([
      ClubModel.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ClubModel.countDocuments(filters),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error("listClubs err", err);
    return res.status(500).json({ message: "Failed to list clubs" });
  }
};

export const listInvites = async (req: any, res: Response) => {
  try {
    const email = req.user?.email;
    if (!email) return res.status(400).json({ message: "Email required" });

    const invites = await ClubInviteModel.find({ email, usedBy: { $exists: false } }).sort({ createdAt: -1 }).lean();
    const clubIds = invites.map(i => i.clubId);
    const clubs = await ClubModel.find({ _id: { $in: clubIds } }).lean();

    const items = invites.map(i => ({
      token: i.token,
      expiresAt: i.expiresAt,
      club: clubs.find(c => String(c._id) === String(i.clubId)) || null,
    })).filter(x => x.club);

    return res.json({ items });
  } catch (err) {
    console.error("listInvites err", err);
    return res.status(500).json({ message: "Failed to list invites" });
  }
};

export const listPublicClubs = async (_req: Request, res: Response) => {
  try {
    const q = (String((_req as any).query?.q || ""));
    const tag = (String((_req as any).query?.tag || ""));
    const page = Math.max(Number((_req as any).query?.page || 1), 1);
    const limit = Math.min(Number((_req as any).query?.limit || 12), 100);
    const skip = (page - 1) * limit;

    const filters: any = { isPublic: true };
    if (q) filters.name = { $regex: q, $options: "i" };
    if (tag) filters.tags = tag;

    const [items, total] = await Promise.all([
      ClubModel.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ClubModel.countDocuments(filters),
    ]);
    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error("listPublicClubs err", err);
    return res.status(500).json({ message: "Failed to list clubs" });
  }
};

/**
 * Get a single club (if private, user must be member)
 */
export const getClub = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(clubId)) return res.status(400).json({ message: "Invalid club id" });

    const club = await ClubModel.findById(clubId).lean();
    if (!club) return res.status(404).json({ message: "Club not found" });

    if (!club.isPublic) {
      const membership = await ClubMembershipModel.findOne({ clubId, userId: req.user?._id, active: true });
      const isAdmin = req.user?.roles?.includes("admin");
      if (!membership && !isAdmin) return res.status(403).json({ message: "Private club" });
    }

    const isMember = Boolean(await ClubMembershipModel.findOne({ clubId, userId: req.user?._id, active: true }));
    const membersSample = await ClubMembershipModel.find({ clubId, active: true })
      .limit(6)
      .populate({ path: "userId", select: "username" })
      .lean();

    return res.json({ club, isMember, membersSample });
  } catch (err) {
    console.error("getClub err", err);
    return res.status(500).json({ message: "Failed to get club" });
  }
};

/**
 * Join public club
 */
export const joinClub = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    const userId = req.user._id;

    const club = await ClubModel.findById(clubId);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (!club.isPublic) return res.status(403).json({ message: "This club is private" });

    const existing = await ClubMembershipModel.findOne({ clubId, userId });
    if (existing) return res.status(400).json({ message: "Already a member" });

    await ClubMembershipModel.create({ clubId, userId, role: "member", joinedAt: new Date(), active: true });
    await ClubModel.findByIdAndUpdate(clubId, { $inc: { memberCount: 1 } });

    return res.json({ message: "Joined club" });
  } catch (err) {
    console.error("joinClub err", err);
    return res.status(500).json({ message: "Failed to join club" });
  }
};

/**
 * Create invite (leader-only)
 */
export const createInvite = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    const inviterId = req.user._id;
    const { email, expiresInHours = 72 } = req.body || {};

    // require leader
    const leader = await ClubMembershipModel.findOne({ clubId, userId: inviterId, role: "leader", active: true });
    const isAdmin = req.user?.roles?.includes("admin");
    if (!leader && !isAdmin) return res.status(403).json({ message: "Only leaders can invite" });

    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + Number(expiresInHours) * 3600 * 1000);

    const invite = await ClubInviteModel.create({ clubId, inviterId, email, token, expiresAt });
    return res.status(201).json({ token: invite.token, expiresAt: invite.expiresAt });
  } catch (err) {
    console.error("createInvite err", err);
    return res.status(500).json({ message: "Failed to create invite" });
  }
};

/**
 * Accept invite
 */
export const acceptInvite = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    const { token } = req.body || {};
    const userId = req.user._id;

    if (!token) return res.status(400).json({ message: "Invite token required" });

    const invite = await ClubInviteModel.findOne({ token, clubId });
    if (!invite) return res.status(400).json({ message: "Invalid invite" });
    if (invite.expiresAt && invite.expiresAt < new Date()) return res.status(400).json({ message: "Invite expired" });
    if (invite.usedBy) return res.status(400).json({ message: "Invite already used" });

    const already = await ClubMembershipModel.findOne({ clubId, userId });
    if (already) return res.status(400).json({ message: "Already a member" });

    await ClubMembershipModel.create({ clubId, userId, role: "member", joinedAt: new Date(), active: true });
    await ClubModel.findByIdAndUpdate(clubId, { $inc: { memberCount: 1 } });

    invite.usedBy = userId;
    await invite.save();

    return res.json({ message: "Joined club via invite" });
  } catch (err) {
    console.error("acceptInvite err", err);
    return res.status(500).json({ message: "Failed to accept invite" });
  }
};

/**
 * Set theme (leader)
 */
export const setTheme = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    const { title, length } = req.body || {};
    if (!title) return res.status(400).json({ message: "Theme title required" });

    const startsAt = new Date();
    let expiresAt = new Date(startsAt);
    if (length === "day") expiresAt.setDate(expiresAt.getDate() + 1);
    else if (length === "week") expiresAt.setDate(expiresAt.getDate() + 7);
    else if (length === "month") expiresAt.setMonth(expiresAt.getMonth() + 1);
    else expiresAt = new Date(startsAt); // zero-length -> immediate expiry (not recommended)

    // permission: leader or admin
    const isLeader = await ClubMembershipModel.findOne({ clubId, userId: req.user._id, role: "leader", active: true });
    const isAdmin = req.user?.roles?.includes("admin");
    if (!isLeader && !isAdmin) return res.status(403).json({ message: "Only leaders can set theme" });

    const club = await ClubModel.findByIdAndUpdate(clubId, { theme: { title, startsAt, expiresAt } }, { new: true });
    return res.json({ message: "Theme set", theme: club?.theme });
  } catch (err) {
    console.error("setTheme err", err);
    return res.status(500).json({ message: "Failed to set theme" });
  }
};

/**
 * Set current book (leader)
 */
export const setCurrentBook = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    const { title, authors = [], coverUrl, totalPages } = req.body || {};

    const isLeader = await ClubMembershipModel.findOne({ clubId, userId: req.user._id, role: "leader", active: true });
    const isAdmin = req.user?.roles?.includes("admin");
    if (!isLeader && !isAdmin) return res.status(403).json({ message: "Only leaders can set book" });

    const club = await ClubModel.findByIdAndUpdate(clubId, { currentBook: { title, authors, coverUrl, totalPages } }, { new: true });
    return res.json({ message: "Current book updated", currentBook: club?.currentBook });
  } catch (err) {
    console.error("setCurrentBook err", err);
    return res.status(500).json({ message: "Failed to set current book" });
  }
};

/**
 * List members (username + role)
 */
export const listMembers = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(clubId)) return res.status(400).json({ message: "Invalid club id" });
    const club = await ClubModel.findById(clubId).lean();
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (!club.isPublic) {
      const membership = await ClubMembershipModel.findOne({ clubId, userId: req.user?._id, active: true });
      const isAdmin = req.user?.roles?.includes("admin");
      if (!membership && !isAdmin) return res.status(403).json({ message: "Private club" });
    }
    const memberships = await ClubMembershipModel.find({ clubId, active: true }).populate({ path: "userId", select: "username email" }).lean();
    const items = memberships.map(m => ({
      userId: String(m.userId?._id || m.userId),
      username: (m as any).userId?.username || "",
      role: m.role,
    }));
    return res.json({ items });
  } catch (err) {
    console.error("listMembers err", err);
    return res.status(500).json({ message: "Failed to list members" });
  }
};

/**
 * Add reading schedule item (leader)
 */
export const addScheduleItem = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    const { title, order, dueDate } = req.body || {};
    if (!title) return res.status(400).json({ message: "title required" });
    const isLeader = await ClubMembershipModel.findOne({ clubId, userId: req.user._id, role: "leader", active: true });
    const isAdmin = req.user?.roles?.includes("admin");
    if (!isLeader && !isAdmin) return res.status(403).json({ message: "Only leaders can edit schedule" });
    const update = { $push: { readingSchedule: { title, order: Number(order) || 0, dueDate: dueDate ? new Date(dueDate) : undefined, completed: false } } };
    const club = await ClubModel.findByIdAndUpdate(clubId, update, { new: true });
    return res.status(201).json({ readingSchedule: club?.readingSchedule || [] });
  } catch (err) {
    console.error("addScheduleItem err", err);
    return res.status(500).json({ message: "Failed to add schedule item" });
  }
};

/**
 * Toggle schedule item completion (leader)
 */
export const toggleScheduleItem = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    const itemId = req.params.itemId;
    const { completed } = req.body || {};
    const isLeader = await ClubMembershipModel.findOne({ clubId, userId: req.user._id, role: "leader", active: true });
    const isAdmin = req.user?.roles?.includes("admin");
    if (!isLeader && !isAdmin) return res.status(403).json({ message: "Only leaders can edit schedule" });
    const club = await ClubModel.findOneAndUpdate(
      { _id: clubId, "readingSchedule._id": itemId },
      { $set: { "readingSchedule.$.completed": Boolean(completed) } },
      { new: true }
    );
    if (!club) return res.status(404).json({ message: "Schedule item not found" });
    return res.json({ readingSchedule: club.readingSchedule });
  } catch (err) {
    console.error("toggleScheduleItem err", err);
    return res.status(500).json({ message: "Failed to update schedule item" });
  }
};

/**
 * Delete schedule item (leader)
 */
export const deleteScheduleItem = async (req: any, res: Response) => {
  try {
    const clubId = req.params.id;
    const itemId = req.params.itemId;
    const isLeader = await ClubMembershipModel.findOne({ clubId, userId: req.user._id, role: "leader", active: true });
    const isAdmin = req.user?.roles?.includes("admin");
    if (!isLeader && !isAdmin) return res.status(403).json({ message: "Only leaders can edit schedule" });
    const club = await ClubModel.findByIdAndUpdate(
      clubId,
      { $pull: { readingSchedule: { _id: itemId } } },
      { new: true }
    );
    if (!club) return res.status(404).json({ message: "Schedule item not found" });
    return res.json({ readingSchedule: club.readingSchedule || [] });
  } catch (err) {
    console.error("deleteScheduleItem err", err);
    return res.status(500).json({ message: "Failed to delete schedule item" });
  }
};
