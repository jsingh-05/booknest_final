// Centralized JWT configuration to ensure same secret is used everywhere
import dotenv from "dotenv";

dotenv.config();

export const JWT_SECRET: string = (process.env.JWT_SECRET || "dev-secret").trim();
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "1h";

// Debug: log secret info in development
if (process.env.NODE_ENV !== "production") {
  console.log("JWT Config loaded - Secret length:", JWT_SECRET.length);
  console.log("JWT Config loaded - Secret (first 20):", JWT_SECRET.substring(0, 20));
}

