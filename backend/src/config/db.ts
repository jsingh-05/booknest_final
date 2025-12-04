import mongoose from "mongoose";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/booknest";

export async function connectDB() {
  const uri = process.env.MONGO_URI || DEFAULT_URI;

  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}


