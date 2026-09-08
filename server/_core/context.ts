import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse } from "cookie";
import type { User } from "../../drizzle/schema";
import { getMemberById } from "../db";
import { readLocalSession } from "../localSession";
import { sdk } from "./sdk";

export const LOCAL_SESSION_COOKIE = "congress-local-session";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function getLocalUser(cookieHeader?: string): Promise<User | null> {
  const token = parse(cookieHeader ?? "")[LOCAL_SESSION_COOKIE];
  const session = await readLocalSession(token);
  if (!session) return null;
  const member = await getMemberById(session.memberId);
  if (!member || !member.active || !member.email) return null;
  return {
    id: member.id,
    openId: `local:${member.id}`,
    name: member.name,
    email: member.email,
    loginMethod: "local",
    role: member.role,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    lastSignedIn: member.updatedAt,
  };
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await getLocalUser(opts.req.headers.cookie);
    if (!user) user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
