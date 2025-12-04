import { Schema, model, Document, Types } from "mongoose";

export interface IClubMembership extends Document {
  clubId: Types.ObjectId;
  userId: Types.ObjectId;
  role: "member" | "leader";
  joinedAt: Date;
  active: boolean;
}

const ClubMembershipSchema = new Schema<IClubMembership>({
  clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["member", "leader"], default: "member" },
  joinedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
});

ClubMembershipSchema.index({ clubId: 1, userId: 1 }, { unique: true });
ClubMembershipSchema.index({ userId: 1 });

export const ClubMembershipModel = model<IClubMembership>("ClubMembership", ClubMembershipSchema);
