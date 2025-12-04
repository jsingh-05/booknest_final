import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { ClubMembershipModel } from "../models/clubMembership.model";
import { Types } from "mongoose";

// Ensure user belongs to the club
export const requireMembership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const clubId = req.params.id;
  const userId = req.user?._id as string | undefined;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!clubId || !Types.ObjectId.isValid(clubId)) {
    return res.status(400).json({ message: "Invalid club id" });
  }
  const membership = await ClubMembershipModel.findOne({
    clubId: new Types.ObjectId(clubId),
    userId: new Types.ObjectId(userId),
    active: true,
  });

  const isAdmin = Array.isArray(req.user?.roles) && req.user!.roles!.includes("admin");

  if (!membership && !isAdmin) {
    return res.status(403).json({ message: "You are not a member of this club." });
  }

  req.membership = membership;
  next();
};

export const allowPublicView = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const clubId = req.params.id;
  if (!clubId || !Types.ObjectId.isValid(clubId)) {
    return res.status(400).json({ message: "Invalid club id" });
  }
  const { ClubModel } = await import("../models/club.model");
  const club = await ClubModel.findById(clubId).lean();
  if (!club) return res.status(404).json({ message: "Club not found" });
  if (club.isPublic) return next();
  const userId = req.user?._id as string | undefined;
  if (!userId) return res.status(401).json({ message: "Authentication required" });
  const membership = await import("../models/clubMembership.model");
  const { ClubMembershipModel } = membership as any;
  const m = await ClubMembershipModel.findOne({ clubId, userId, active: true });
  const isAdmin = Array.isArray(req.user?.roles) && req.user!.roles!.includes("admin");
  if (!m && !isAdmin) return res.status(403).json({ message: "Private club" });
  next();
};

export const requireClubLeader = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const clubId = req.params.id;
  const userId = req.user?._id as string | undefined;

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!clubId || !Types.ObjectId.isValid(clubId)) {
    return res.status(400).json({ message: "Invalid club id" });
  }
// find leader membership
  const membership = await ClubMembershipModel.findOne({
    clubId: new Types.ObjectId(clubId),
    userId: new Types.ObjectId(userId),
    role: "leader",
    active: true,
  });
const isAdmin = Array.isArray(req.user?.roles) && req.user!.roles!.includes("admin");
  if (!membership && !isAdmin) {
    return res.status(403).json({ message: "Only club leaders can do this action." });
  }
req.membership = membership;
next();
};
