import dotenv from "dotenv";
import { connectDB } from "../config/db";
import { UserModel } from "../models/user.model";

dotenv.config();

async function makeAdmin(email: string) {
  await connectDB();
  const user = await UserModel.findOne({ email }).exec();
  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (!roles.includes("admin")) {
    roles.push("admin");
    user.roles = roles;
    await user.save();
    console.log("Promoted to admin:", email);
  } else {
    console.log("Already admin:", email);
  }
  process.exit(0);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: ts-node backend_cursor/src/seed/makeAdmin.ts <email>");
  process.exit(1);
}

makeAdmin(email).catch((e) => { console.error(e); process.exit(1); });

