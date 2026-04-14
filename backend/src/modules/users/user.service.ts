import { storage } from "../../services/storage.service";
import type { User } from "@shared/schema";

export async function getUserById(id: string): Promise<User | undefined> {
  return storage.getUser(id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  return storage.getUserByUsername(username);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return storage.getUserByEmail(email);
}
