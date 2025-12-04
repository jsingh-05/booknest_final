import { Schema, model, Document, Types } from "mongoose";

export interface IClubInvite extends Document {
  clubId: Types.ObjectId;
  inviterId: Types.ObjectId;
  email?: string;
  token: string;
  expiresAt?: Date;
  usedBy?: Types.ObjectId;
  createdAt: Date;
}

const ClubInviteSchema = new Schema<IClubInvite>({
  clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
  inviterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  email: { type: String },
  token: { type: String, required: true, index: true, unique: true },
  expiresAt: { type: Date },
  usedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export const ClubInviteModel = model<IClubInvite>("ClubInvite", ClubInviteSchema);
