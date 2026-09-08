import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  categories,
  conferenceTasks,
  configurationItems,
  documents,
  emailMessages,
  events,
  groupMembers,
  InsertUser,
  meetings,
  members,
  taskAssignments,
  taskNotes,
  taskVerifications,
  users,
  workGroups,
  smtpSettings,
} from "../drizzle/schema";
import { initialMembers, initialTasks } from "./seed";
import { hashPassword } from "./localAuth";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let seedAttempted = false;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

const clean = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const usableName = (value?: string | null) => Boolean(value && !value.toLowerCase().includes("pendiente"));

function normalizedRole(role: string) {
  if (role === "admin" || role === "direction") return "admin";
  if (role === "viewer") return "viewer";
  return "collaborator";
}

export async function ensureSeedData() {
  if (seedAttempted) return;
  const db = await getDb();
  if (!db) return;
  seedAttempted = true;

  let [event] = await db.select().from(events).where(eq(events.shortName, "7WP&OMC")).limit(1);
  if (!event) {
    await db.insert(events).values({ name: "7th World P&OM Conference", shortName: "7WP&OMC", location: "Sevilla", startDate: "01/09/2027", endDate: "04/09/2027", status: "Planificación" });
    [event] = await db.select().from(events).where(eq(events.shortName, "7WP&OMC")).limit(1);
  }
  if (!event) throw new Error("No se pudo crear el congreso inicial");

  const [existingMember] = await db.select({ id: members.id }).from(members).limit(1);
  if (!existingMember) await db.insert(members).values(initialMembers.map(member => ({ ...member, role: normalizedRole(member.role) })) as typeof members.$inferInsert[]);

  const existingCategories = await db.select().from(categories).where(eq(categories.eventId, event.id));
  if (!existingCategories.length) {
    const names = Array.from(new Set(initialTasks.map(task => task.workBlock)));
    const palette = ["#173c59", "#a7772f", "#527d68", "#725b91", "#b8604e", "#3f6f8a", "#7a7253"];
    await db.insert(categories).values(names.map((name, index) => ({ eventId: event.id, name, color: palette[index % palette.length] })));
  }

  const [existingTask] = await db.select({ id: conferenceTasks.id }).from(conferenceTasks).limit(1);
  if (!existingTask) await db.insert(conferenceTasks).values(initialTasks as unknown as typeof conferenceTasks.$inferInsert[]);

  const cats = await db.select().from(categories).where(eq(categories.eventId, event.id));
  const taskRows = await db.select().from(conferenceTasks);
  for (const task of taskRows.filter(task => task.eventId === null)) {
    const category = cats.find(item => item.name === task.workBlock);
    await db.update(conferenceTasks).set({ eventId: event.id, categoryId: category?.id ?? null }).where(eq(conferenceTasks.id, task.id));
  }

  const existingGroups = await db.select().from(workGroups).where(eq(workGroups.eventId, event.id));
  if (!existingGroups.length) {
    await db.insert(workGroups).values([
      { eventId: event.id, name: "Dirección", description: "Organización general y decisiones" },
      { eventId: event.id, name: "Comité local", description: "Sede, logística y experiencia" },
      { eventId: event.id, name: "Comité científico", description: "Programa y revisión" },
      { eventId: event.id, name: "Secretaría técnica", description: "Inscripciones y soporte operativo" },
    ]);
  }

  const allMembers = await db.select().from(members);
  const groups = await db.select().from(workGroups).where(eq(workGroups.eventId, event.id));
  const memberships = await db.select().from(groupMembers);
  if (!memberships.length) {
    for (const group of groups) {
      const label = group.name.toLowerCase();
      const matching = allMembers.filter(member => {
        const committee = member.committee?.toLowerCase() ?? "";
        return (label === "dirección" && committee.includes("dirección")) ||
          (label === "comité local" && committee.includes("local")) ||
          (label === "comité científico" && committee.includes("científico")) ||
          (label === "secretaría técnica" && committee.includes("secretaría"));
      });
      if (matching.length) await db.insert(groupMembers).values(matching.map(member => ({ groupId: group.id, memberId: member.id })));
    }
  }

  const assignments = await db.select({ id: taskAssignments.id }).from(taskAssignments).limit(1);
  if (!assignments.length) {
    const seededTasks = await db.select().from(conferenceTasks).where(eq(conferenceTasks.eventId, event.id));
    const nowGroups = await db.select().from(workGroups).where(eq(workGroups.eventId, event.id));
    const values: Array<typeof taskAssignments.$inferInsert> = [];
    for (const task of seededTasks) {
      const assignees = [task.responsible, task.coResponsible1, task.coResponsible2, task.support].filter(usableName) as string[];
      allMembers.forEach(member => {
        if (assignees.some(person => clean(person).includes(clean(member.name)) || clean(member.name).includes(clean(person)))) values.push({ taskId: task.id, memberId: member.id, groupId: null });
      });
      const committee = task.committee?.toLowerCase() ?? "";
      const group = nowGroups.find(item => (item.name === "Comité local" && committee.includes("local")) || (item.name === "Comité científico" && committee.includes("científico")) || (item.name === "Secretaría técnica" && committee.includes("secretaría")) || (item.name === "Dirección" && (committee.includes("dirección") || committee.includes("ejecutivo"))));
      if (group) values.push({ taskId: task.id, memberId: null, groupId: group.id });
    }
    if (values.length) await db.insert(taskAssignments).values(values);
  }

  const existingConfiguration = await db.select().from(configurationItems);
  const defaultConfiguration = [
    ["estado", "Pendiente"], ["estado", "En curso"], ["estado", "Resuelta"], ["estado", "Adjudicada a otro comité"], ["estado", "Bloqueada"], ["estado", "No aplica"], ["estado", "Revisar"],
    ["prioridad", "Alta"], ["prioridad", "Media"], ["prioridad", "Baja"],
    ["comité", "Local Organizing Committee"], ["comité", "Comité Científico / ACEDEDOT"], ["comité", "Comité Ejecutivo ACEDEDOT"], ["comité", "Comité de Comunicación Local"], ["comité", "Steering Committee 7WP&OMC"], ["comité", "Secretaría Técnica GRX"], ["comité", "Tesorería / Finanzas Local"], ["comité", "Pendiente de asignar"], ["comité", "Program Committee Chairs"], ["comité", "ACEDEDOT"], ["comité", "ACEDEDOT y Local Organizing Committee"], ["comité", "Comité comunicación local y ACEDEDOT"], ["comité", "GRX y Comité Ejecutivo ACEDEDOT"],
    ["módulo", "Dashboard"], ["módulo", "Notifications"], ["módulo", "Calendar"], ["módulo", "Messages"], ["módulo", "Announcements"], ["módulo", "Meetings"], ["módulo", "Conferences"], ["módulo", "Paper Proposals"], ["módulo", "Events"], ["módulo", "Documents"], ["módulo", "Links"], ["módulo", "Tasks"], ["módulo", "Users"], ["módulo", "Settings"], ["módulo", "No aplica"],
    ["fase", "0. Arranque"], ["fase", "1. Planificación general"], ["fase", "2. Programa científico"], ["fase", "3. Plataforma y comunicación"], ["fase", "4. Participantes"], ["fase", "5. Logística local"], ["fase", "6. Protocolo y actos"], ["fase", "7. Ejecución"], ["fase", "8. Cierre"], ["fase", "Transversal"],
    ["cargo", "Pendiente de Asignar"], ["cargo", "Chair"], ["cargo", "Co-Chair"], ["cargo", "CO-Chair Invited sessions and Keynotes"], ["posición", "Responsable"], ["posición", "Miembro"], ["posición", "Apoyo"],
    ["tipo_publicación", "Papers"], ["tipo_publicación", "Abstracts"], ["tipo_publicación", "Extended Abstracts"], ["tipo_publicación", "Posters"],
  ] as const;
  const missingConfiguration = defaultConfiguration.filter(([type, name]) => !existingConfiguration.some(item => item.type === type && item.name === name)).map(([type, name]) => ({ type, name, description: null }));
  if (missingConfiguration.length) await db.insert(configurationItems).values(missingConfiguration);

  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (initialAdminEmail && initialAdminPassword) {
    const [existingInitialAdmin] = await db.select().from(members).where(eq(members.email, initialAdminEmail)).limit(1);
    if (!existingInitialAdmin) {
      await db.insert(members).values({
        name: process.env.INITIAL_ADMIN_NAME?.trim() || "Administrador inicial",
        email: initialAdminEmail,
        passwordHash: await hashPassword(initialAdminPassword),
        role: "admin",
        position: "Administrador",
        active: true,
      });
    } else if (!existingInitialAdmin.passwordHash) {
      // An imported collaborator may already have the same email. Complete
      // that profile only once, without overwriting an established password.
      await db.update(members).set({
        name: process.env.INITIAL_ADMIN_NAME?.trim() || existingInitialAdmin.name,
        passwordHash: await hashPassword(initialAdminPassword),
        role: "admin",
        position: existingInitialAdmin.position || "Administrador",
        active: true,
      }).where(eq(members.id, existingInitialAdmin.id));
    }
  }
}

export async function getEffectiveRole(user: { email?: string | null; role: string }) {
  const db = await getDb();
  if (!db || !user.email) return normalizedRole(user.role);
  const [profile] = await db.select().from(members).where(eq(members.email, user.email)).limit(1);
  if (profile && !profile.active) return "viewer";
  return profile ? normalizedRole(profile.role) : normalizedRole(user.role);
}

export async function getCurrentMember(user: { email?: string | null; name?: string | null }) {
  const db = await getDb();
  if (!db) return undefined;
  if (user.email) {
    const [byEmail] = await db.select().from(members).where(eq(members.email, user.email)).limit(1);
    if (byEmail) return byEmail;
  }
  const userName = user.name;
  if (!userName) return undefined;
  const all = await db.select().from(members);
  return all.find(member => clean(member.name) === clean(userName));
}

export async function getMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [member] = await db.select().from(members).where(eq(members.id, id)).limit(1);
  return member;
}

export async function getMemberByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const matches = await db.select().from(members).where(eq(members.email, email.trim().toLowerCase()));
  return matches.find(member => Boolean(member.passwordHash) && member.active) ?? matches[0];
}

export async function listEvents() { await ensureSeedData(); const db = await getDb(); return db ? db.select().from(events) : []; }
export async function listCategories(eventId: number) { await ensureSeedData(); const db = await getDb(); return db ? db.select().from(categories).where(eq(categories.eventId, eventId)) : []; }
export async function listMembers() { await ensureSeedData(); const db = await getDb(); return db ? db.select().from(members) : []; }
export async function listGroups(eventId: number) { await ensureSeedData(); const db = await getDb(); return db ? db.select().from(workGroups).where(eq(workGroups.eventId, eventId)) : []; }
export async function listGroupMembers() { const db = await getDb(); return db ? db.select().from(groupMembers) : []; }
export async function listTaskAssignments() { const db = await getDb(); return db ? db.select().from(taskAssignments) : []; }

export async function listTasks(eventId: number) {
  await ensureSeedData(); const db = await getDb();
  return db ? db.select().from(conferenceTasks).where(eq(conferenceTasks.eventId, eventId)) : [];
}

export function assignedTaskIdsForMember(memberId: number, memberships: Array<{ memberId: number; groupId: number }>, assignments: Array<{ taskId: number; memberId: number | null; groupId: number | null }>) {
  const groupIds = new Set(memberships.filter(item => item.memberId === memberId).map(item => item.groupId));
  return new Set([
    ...assignments.filter(item => item.memberId === memberId).map(item => item.taskId),
    ...assignments.filter(item => item.groupId !== null && groupIds.has(item.groupId)).map(item => item.taskId),
  ]);
}

export async function listAssignedTasks(eventId: number, memberId: number) {
  const [tasks, memberships, assignments] = await Promise.all([listTasks(eventId), listGroupMembers(), listTaskAssignments()]);
  const taskIds = assignedTaskIdsForMember(memberId, memberships, assignments);
  return tasks.filter(task => taskIds.has(task.id));
}

export async function getTaskById(id: number) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(conferenceTasks).where(eq(conferenceTasks.id, id)).limit(1); return rows[0]; }
export async function createTask(values: typeof conferenceTasks.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(conferenceTasks).values(values); }
export async function updateTask(id: number, values: Partial<typeof conferenceTasks.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.update(conferenceTasks).set(values).where(eq(conferenceTasks.id, id)); return getTaskById(id); }

export async function replaceTaskAssignments(taskId: number, memberIds: number[], groupIds: number[]) {
  const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible");
  await db.delete(taskAssignments).where(eq(taskAssignments.taskId, taskId));
  const records = [...memberIds.map(memberId => ({ taskId, memberId, groupId: null })), ...groupIds.map(groupId => ({ taskId, memberId: null, groupId }))];
  if (records.length) await db.insert(taskAssignments).values(records);
}

export async function listTaskNotes(taskId: number) { const db = await getDb(); return db ? db.select().from(taskNotes).where(eq(taskNotes.taskId, taskId)) : []; }
export async function addTaskNote(values: typeof taskNotes.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(taskNotes).values(values); }

export async function createEvent(values: typeof events.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(events).values(values); }
export async function createCategory(values: typeof categories.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(categories).values(values); }
export async function updateEvent(id: number, values: Partial<typeof events.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.update(events).set(values).where(eq(events.id, id)); }
export async function updateCategory(id: number, values: Partial<typeof categories.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.update(categories).set(values).where(eq(categories.id, id)); }
export async function deleteCategorySafely(id: number) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); const linkedTasks = await db.select({ id: conferenceTasks.id }).from(conferenceTasks).where(eq(conferenceTasks.categoryId, id)); await db.update(conferenceTasks).set({ categoryId: null }).where(eq(conferenceTasks.categoryId, id)); await db.delete(categories).where(eq(categories.id, id)); return linkedTasks.length; }
export async function createMember(values: typeof members.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(members).values(values); }
export async function updateMember(id: number, values: Partial<typeof members.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.update(members).set(values).where(eq(members.id, id)); if (values.email && values.role) await db.update(users).set({ role: values.role }).where(eq(users.email, values.email)); }
export async function createGroup(values: typeof workGroups.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(workGroups).values(values); }
export async function updateGroup(id: number, values: Partial<typeof workGroups.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.update(workGroups).set(values).where(eq(workGroups.id, id)); }
export async function replaceGroupMembers(groupId: number, memberIds: number[]) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId)); if (memberIds.length) await db.insert(groupMembers).values(memberIds.map(memberId => ({ groupId, memberId }))); }
export async function listConfigurationItems() { await ensureSeedData(); const db = await getDb(); return db ? db.select().from(configurationItems) : []; }
export async function createConfigurationItem(values: typeof configurationItems.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(configurationItems).values(values); }
export async function updateConfigurationItem(id: number, values: Partial<typeof configurationItems.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.update(configurationItems).set(values).where(eq(configurationItems.id, id)); }

export async function createTaskVerification(values: typeof taskVerifications.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(taskVerifications).values(values); }
export async function listTaskVerifications(taskIds: number[]) { const db = await getDb(); if (!db || !taskIds.length) return []; const all = await db.select().from(taskVerifications); return all.filter(verification => taskIds.includes(verification.taskId)); }
export async function getTaskVerification(id: number) { const db = await getDb(); if (!db) return undefined; const [verification] = await db.select().from(taskVerifications).where(eq(taskVerifications.id, id)).limit(1); return verification; }
export async function reviewTaskVerification(id: number, values: Partial<typeof taskVerifications.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.update(taskVerifications).set(values).where(eq(taskVerifications.id, id)); }

export async function getSmtpSettings() { const db = await getDb(); if (!db) return undefined; const [settings] = await db.select().from(smtpSettings).limit(1); return settings; }
export async function saveSmtpSettings(values: typeof smtpSettings.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); const current = await getSmtpSettings(); if (current) { await db.update(smtpSettings).set(values).where(eq(smtpSettings.id, current.id)); return current.id; } const result = await db.insert(smtpSettings).values(values); return Number(result[0].insertId); }
export async function addEmailMessage(values: typeof emailMessages.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(emailMessages).values(values); }
export async function listEmailMessages(eventId: number) { const db = await getDb(); if (!db) return []; const all = await db.select().from(emailMessages); return all.filter(message => message.eventId === eventId); }
export async function resolveMessageRecipients(memberIds: number[], groupIds: number[]) { const db = await getDb(); if (!db) return []; const [allMembers, allMemberships] = await Promise.all([db.select().from(members), db.select().from(groupMembers)]); const groupMemberIds = allMemberships.filter(row => groupIds.includes(row.groupId)).map(row => row.memberId); const ids = new Set([...memberIds, ...groupMemberIds]); return allMembers.filter(member => ids.has(member.id) && member.active && Boolean(member.email)); }
export async function getOrganizerRecipients() { const db = await getDb(); if (!db) return []; const allMembers = await db.select().from(members); return allMembers.filter(member => member.active && (member.role === "admin" || member.role === "direction") && Boolean(member.email)); }

export async function listMeetings() { const db = await getDb(); return db ? db.select().from(meetings) : []; }
export async function createMeeting(values: typeof meetings.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(meetings).values(values); }
export async function listDocuments(eventId: number) { const db = await getDb(); if (!db) return []; const all = await db.select().from(documents); return all.filter(document => document.eventId === eventId || document.eventId === null); }
export async function getDocumentByKey(storageKey: string) { const db = await getDb(); if (!db) return undefined; const [document] = await db.select().from(documents).where(eq(documents.storageKey, storageKey)).limit(1); return document; }
export async function createDocument(values: typeof documents.$inferInsert) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.insert(documents).values(values); }
export async function deleteDocument(id: number) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); return db.delete(documents).where(eq(documents.id, id)); }
