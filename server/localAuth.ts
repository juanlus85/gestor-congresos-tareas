import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(hash, "hex");
  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}

export async function findMemberWithPassword<T extends { active: boolean; passwordHash: string | null }>(members: T[], password: string) {
  for (const member of members) {
    if (member.active && await verifyPassword(password, member.passwordHash)) return member;
  }
  return undefined;
}

export function isPasswordValid(password: string) {
  return password.length >= 10 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}
