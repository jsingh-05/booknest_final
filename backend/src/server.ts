import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./routes/auth.routes";
import { connectDB } from "./config/db";
import bookRouter from "./routes/book.routes";
import userRouter from "./routes/user.routes";
import clubRouter from "./routes/club.routes";
import http from "http";
import { createSocketServer } from "./socket";
import chatRoutes from "./routes/chat.routes";
import genieRouter from "./routes/genie.routes";
import recommendRouter from "./routes/recommender.routes";


const app = express();

dotenv.config();

app.use(cors({
  origin: ["https://booknestfrontendfinal.vercel.app"],
  credentials: true,
}));

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/books", bookRouter);
app.use("/api/clubs", clubRouter);
app.use("/api/clubs", chatRoutes);
app.use("/api/gemini-genie", genieRouter);
app.use("/api/recommend", recommendRouter);

const server = http.createServer(app);
createSocketServer(server);

const PORT = process.env.PORT || 5001;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
