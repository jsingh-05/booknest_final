import { Schema, model, Document, Types } from "mongoose";

export interface IMessage extends Document {
  clubId: Types.ObjectId;
  senderId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  body: string;
  deleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, ref: "Message", required: false, index: true },
  body: { type: String, required: true },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, required: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

// index for pagination
MessageSchema.index({ clubId: 1, createdAt: -1 });
MessageSchema.index({ clubId: 1, parentId: 1, createdAt: 1 });

export const MessageModel = model<IMessage>("Message", MessageSchema);
