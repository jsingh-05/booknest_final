import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

type CreateUserInput = {
  email: string;
  password: string;
  name: string;
};

type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
};

const users = new Map<string, UserRecord>();

export async function createUser(input: CreateUserInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user: UserRecord = {
    id: randomUUID(),
    email: input.email,
    name: input.name,
    passwordHash,
  };

  users.set(user.email, user);
  return user;
}

export async function findUserByEmail(email: string) {
  return users.get(email);
}

export async function verifyUserPassword(email: string, password: string) {
  const user = users.get(email);
  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  return isValid ? user : null;
}
