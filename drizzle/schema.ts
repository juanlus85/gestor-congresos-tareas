import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const userRoles = [
  "user",
  "admin",
  "direction",
  "local_member",
  "scientific",
  "technical",
  "collaborator",
  "viewer",
] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", userRoles).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const members = mysqlTable("members", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", userRoles).default("viewer").notNull(),
  committee: varchar("committee", { length: 255 }),
  position: varchar("position", { length: 255 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const conferenceTasks = mysqlTable("conferenceTasks", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 32 }).notNull().unique(),
  phase: varchar("phase", { length: 120 }).notNull(),
  workBlock: varchar("workBlock", { length: 120 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  observations: text("observations"),
  status: varchar("status", { length: 64 }).default("Pendiente").notNull(),
  committee: varchar("committee", { length: 255 }),
  responsible: varchar("responsible", { length: 255 }),
  coResponsible1: varchar("coResponsible1", { length: 255 }),
  coResponsible2: varchar("coResponsible2", { length: 255 }),
  support: varchar("support", { length: 255 }),
  priority: varchar("priority", { length: 32 }).default("Media").notNull(),
  scope: varchar("scope", { length: 255 }),
  platformModule: varchar("platformModule", { length: 80 }),
  team: varchar("team", { length: 255 }),
  plannedStart: varchar("plannedStart", { length: 64 }),
  dueDate: varchar("dueDate", { length: 64 }),
  actualClose: varchar("actualClose", { length: 64 }),
  deliverable: text("deliverable"),
  dependencies: text("dependencies"),
  risk: text("risk"),
  decisionRequired: text("decisionRequired"),
  assignedAtMeeting: text("assignedAtMeeting"),
  costEstimate: varchar("costEstimate", { length: 64 }),
  costActual: varchar("costActual", { length: 64 }),
  progress: int("progress").default(0).notNull(),
  localEligible: boolean("localEligible").default(false).notNull(),
  localWorkstream: varchar("localWorkstream", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const taskNotes = mysqlTable("taskNotes", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  scheduledAt: varchar("scheduledAt", { length: 64 }).notNull(),
  committee: varchar("committee", { length: 255 }).notNull(),
  agenda: text("agenda"),
  notes: text("notes"),
  status: varchar("status", { length: 32 }).default("Planificada").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  url: text("url"),
  owner: varchar("owner", { length: 255 }),
  visibility: varchar("visibility", { length: 32 }).default("Comités").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ConferenceTask = typeof conferenceTasks.$inferSelect;
export type Member = typeof members.$inferSelect;
