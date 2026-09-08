import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  conferenceTasks,
  documents,
  InsertUser,
  meetings,
  members,
  taskNotes,
  users,
} from "../drizzle/schema";
import { initialMembers, initialTasks } from "./seed";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let seedAttempted = false;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function ensureSeedData() {
  if (seedAttempted) return;
  const db = await getDb();
  if (!db) return;
  seedAttempted = true;
  const [existingTask] = await db.select({ id: conferenceTasks.id }).from(conferenceTasks).limit(1);
  if (!existingTask) {
    await db.insert(conferenceTasks).values(initialTasks as unknown as typeof conferenceTasks.$inferInsert[]);
  }
  const [existingMember] = await db.select({ id: members.id }).from(members).limit(1);
  if (!existingMember) {
    await db.insert(members).values(initialMembers as unknown as typeof members.$inferInsert[]);
  }
}

export async function getEffectiveRole(user: { email?: string | null; role: string }) {
  const db = await getDb();
  if (!db || !user.email) return user.role;
  const [profile] = await db.select().from(members).where(eq(members.email, user.email)).limit(1);
  if (profile && !profile.active) return "viewer";
  return profile?.role ?? user.role;
}

export async function listTasks() {
  await ensureSeedData();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conferenceTasks).orderBy(conferenceTasks.phase, conferenceTasks.workBlock, conferenceTasks.externalId);
}

export async function getTaskById(id: number) {
  await ensureSeedData();
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(conferenceTasks).where(eq(conferenceTasks.id, id)).limit(1);
  return rows[0];
}

export async function createTask(values: typeof conferenceTasks.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  const result = await db.insert(conferenceTasks).values(values);
  return result;
}

export async function updateTask(id: number, values: Partial<typeof conferenceTasks.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  await db.update(conferenceTasks).set(values).where(eq(conferenceTasks.id, id));
  return getTaskById(id);
}

export async function listTaskNotes(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taskNotes).where(eq(taskNotes.taskId, taskId)).orderBy(desc(taskNotes.createdAt));
}

export async function addTaskNote(values: typeof taskNotes.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  return db.insert(taskNotes).values(values);
}

export async function listMembers() {
  await ensureSeedData();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(members).orderBy(members.committee, members.name);
}

export async function createMember(values: typeof members.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  return db.insert(members).values(values);
}

export async function updateMember(id: number, values: Partial<typeof members.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  await db.update(members).set(values).where(eq(members.id, id));
  if (values.email && values.role) {
    await db.update(users).set({ role: values.role }).where(eq(users.email, values.email));
  }
  return db.select().from(members).where(eq(members.id, id)).limit(1);
}

export async function listMeetings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meetings).orderBy(meetings.scheduledAt);
}

export async function createMeeting(values: typeof meetings.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  return db.insert(meetings).values(values);
}

export async function listDocuments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).orderBy(desc(documents.createdAt));
}

export async function createDocument(values: typeof documents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  return db.insert(documents).values(values);
}
