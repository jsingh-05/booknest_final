import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { UserModel, IUser, IPreference } from "../models/user.model";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/jwt.config";

export type RegisterInput = {
  email: string;
  username: string;
  password: string;
  preferences?: string[];
  dislikes?: string[];
};

function sanitizeTags(tags?: string[]) {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((t) => String(t || "").trim().toLowerCase())
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[^a-z0-9\-\s]/g, ""))
    .map((t) => t.replace(/\s+/g, "-"))
    .slice(0, 100);
  // dedupe
  return Array.from(new Set(cleaned));
}

function convertPreferences(genres?: string[]): IPreference[] {
  const cleaned = sanitizeTags(genres);
  const now = new Date();
  return cleaned.map((genre) => ({ genre, weight: 0.8, lastUpdated: now }));
}

export async function createUser(input: RegisterInput) {
  const exists = await UserModel.findOne({ email: input.email }).exec();
  if (exists) {
    const err: any = new Error("User already exists");
    err.code = "USER_EXISTS";
    throw err;
  }

  // Check username uniqueness
  const usernameExists = await UserModel.findOne({ username: input.username }).exec();
  if (usernameExists) {
    const err: any = new Error("Username already taken");
    err.code = "USERNAME_EXISTS";
    throw err;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const preferences = convertPreferences(input.preferences);
  const dislikes = sanitizeTags(input.dislikes).map((tag) => ({ tag, weight: 0.1, lastUpdated: new Date() }));

  const user = new UserModel({
    email: input.email,
    username: input.username,
    passwordHash,
    preferences,
    dislikes,
  });

  await user.save();

  return user;
}

export async function verifyUserPassword(email: string, password: string) {
  const user = await UserModel.findOne({ email }).exec();
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return user;
}

export async function findUserById(userId: string) {
  return await UserModel.findById(userId).exec();
}

export function signJwt(user: IUser): string {
  const payload = { userId: user._id.toString(), email: user.email, roles: user.roles };
  // @ts-ignore - jsonwebtoken types can be strict about expiresIn format
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyJwt(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    userId: string;
    email: string;
    roles: string[];
  };
}
