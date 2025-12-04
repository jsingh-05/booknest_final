// src/socket.ts
import { Server as IOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import http from "http";
import { JWT_SECRET } from "./config/jwt.config";
import { MessageModel } from "./models/message.model";
import { ClubModel } from "./models/club.model";
import { ClubMembershipModel } from "./models/clubMembership.model";
import mongoose from "mongoose";

/**
 * Attach Socket.IO to your existing HTTP server.
 * Usage (in server.ts):
 *   import { createSocketServer } from './socket';
 *   const httpServer = http.createServer(app);
 *   const io = createSocketServer(httpServer);
 *   httpServer.listen(PORT);
 */

export function createSocketServer(httpServer: http.Server) {
  const io = new IOServer(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
    maxHttpBufferSize: 1e6, // 1MB
  });

  // Middleware to authenticate socket using JWT in query or auth payload
  io.use(async (socket: Socket, next) => {
    try {
      // token may be sent as: socket.handshake.auth.token
      const token = socket.handshake.auth?.token || (socket.handshake.headers?.authorization || "").split(" ")[1];
      if (!token) return next(new Error("Auth token required"));

      const payload: any = jwt.verify(token, JWT_SECRET);
      const userId = payload.userId || payload.id || payload._id;
      if (!userId) return next(new Error("Invalid token payload"));

      // attach user info to socket.data
      socket.data.user = { _id: userId, email: payload.email, roles: payload.roles || [] };
      return next();
    } catch (err) {
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    console.log(`socket connected: ${socket.id} user=${user?._id}`);

    // join a club room (client emits 'join_club' with { clubId })
    socket.on("join_club", async (payload: { clubId: string }, ack) => {
      try {
        const { clubId } = payload;
        if (!mongoose.Types.ObjectId.isValid(clubId)) return ack?.({ ok: false, error: "Invalid clubId" });

        // ensure user is member (or admin)
        const isMember = await ClubMembershipModel.findOne({ clubId, userId: user._id, active: true });
        const isAdmin = Array.isArray(user.roles) && user.roles.includes("admin");
        if (!isMember && !isAdmin) return ack?.({ ok: false, error: "Not a member" });

        socket.join(`club_${clubId}`);
        return ack?.({ ok: true });
      } catch (err) {
        console.error("join_club error", err);
        return ack?.({ ok: false, error: "Server error" });
      }
    });

    // leave a club
    socket.on("leave_club", (payload: { clubId: string }, ack) => {
      const { clubId } = payload;
      socket.leave(`club_${clubId}`);
      ack?.({ ok: true });
    });

    // send a message (persist then broadcast)
    socket.on("send_message", async (payload: { clubId: string; content: string }, ack) => {
      try {
        const { clubId, content } = payload;
        if (!content || typeof content !== "string" || !content.trim()) return ack?.({ ok: false, error: "Empty message" });
        const trimmed = content.trim();
        if (trimmed.length > 2000) return ack?.({ ok: false, error: "Message too long" });

        // membership check (enforce server-side)
        const isMember = await ClubMembershipModel.findOne({ clubId, userId: user._id, active: true });
        const isAdmin = Array.isArray(user.roles) && user.roles.includes("admin");
        if (!isMember && !isAdmin) return ack?.({ ok: false, error: "Not a member" });

        // Persist message
        const message = await MessageModel.create({
          clubId: new mongoose.Types.ObjectId(clubId),
          senderId: new mongoose.Types.ObjectId(user._id),
          body: trimmed,
        });

        // populate small user info
        const out = {
          _id: message._id,
          clubId: message.clubId,
          user: { _id: user._id, email: user.email },
          content: message.body,
          createdAt: message.createdAt,
        };

        // Broadcast to room
        io.to(`club_${clubId}`).emit("new_message", out);

        // ack success
        return ack?.({ ok: true, message: out });
      } catch (err) {
        console.error("send_message error", err);
        return ack?.({ ok: false, error: "Server error" });
      }
    });

    // optional: handle disconnect
    socket.on("disconnect", (reason) => {
      console.log(`socket ${socket.id} disconnected: ${reason}`);
    });
  });

  return io;
}
