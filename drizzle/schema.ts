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

export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("shortName", { length: 80 }).notNull().unique(),
  location: varchar("location", { length: 255 }),
  startDate: varchar("startDate", { length: 32 }),
  endDate: varchar("endDate", { length: 32 }),
  status: varchar("status", { length: 32 }).default("Planificación").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  color: varchar("color", { length: 16 }).default("#173c59").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const members = mysqlTable("members", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", userRoles).default("collaborator").notNull(),
  committee: varchar("committee", { length: 255 }),
  jobTitle: varchar("jobTitle", { length: 255 }),
  position: varchar("position", { length: 255 }),
  organization: varchar("organization", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const configurationItems = mysqlTable("configurationItems", {
  id: int("id").autoincrement().primaryKey(),
  type: varchar("type", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const smtpSettings = mysqlTable("smtpSettings", {
  id: int("id").autoincrement().primaryKey(),
  host: varchar("host", { length: 255 }).notNull(),
  port: int("port").notNull().default(587),
  username: varchar("username", { length: 320 }),
  passwordEncrypted: text("passwordEncrypted"),
  fromName: varchar("fromName", { length: 255 }).notNull(),
  fromEmail: varchar("fromEmail", { length: 320 }).notNull(),
  secure: boolean("secure").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const emailMessages = mysqlTable("emailMessages", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId"),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  recipients: text("recipients").notNull(),
  recipientCount: int("recipientCount").notNull(),
  createdBy: varchar("createdBy", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).default("Enviado").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const workGroups = mysqlTable("workGroups", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const groupMembers = mysqlTable("groupMembers", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  memberId: int("memberId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const conferenceTasks = mysqlTable("conferenceTasks", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId"),
  categoryId: int("categoryId"),
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
  publicationType: varchar("publicationType", { length: 120 }),
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

export const taskVerifications = mysqlTable("taskVerifications", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  submittedByMemberId: int("submittedByMemberId"),
  submittedByName: varchar("submittedByName", { length: 255 }).notNull(),
  note: text("note"),
  status: varchar("status", { length: 32 }).default("Pendiente").notNull(),
  reviewedByName: varchar("reviewedByName", { length: 255 }),
  reviewerNote: text("reviewerNote"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
});

export const taskAssignments = mysqlTable("taskAssignments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  memberId: int("memberId"),
  groupId: int("groupId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
  eventId: int("eventId"),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  url: text("url"),
  storageKey: varchar("storageKey", { length: 500 }),
  fileName: varchar("fileName", { length: 500 }),
  mimeType: varchar("mimeType", { length: 255 }),
  sizeBytes: int("sizeBytes"),
  owner: varchar("owner", { length: 255 }),
  visibility: varchar("visibility", { length: 32 }).default("Comités").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Personas y grupos autorizados cuando un documento usa visibilidad Asignados. */
export const documentAccess = mysqlTable("documentAccess", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  memberId: int("memberId"),
  groupId: int("groupId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ConferenceTask = typeof conferenceTasks.$inferSelect;
export type Member = typeof members.$inferSelect;
