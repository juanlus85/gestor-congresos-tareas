import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { LOCAL_SESSION_COOKIE } from "./_core/context";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { isPasswordValid, hashPassword } from "./localAuth";
import { createLocalSession } from "./localSession";
import { sendSmtpMessage } from "./mailer";
import { canManageWorkspace, isOrganizer, roleLabels } from "./permissions";
import { encryptSecret } from "./secretCrypto";
import { decodeDocument, saveDocument } from "./documentStorage";

const taskStatuses = ["Pendiente", "En curso", "Pendiente de verificación", "Resuelta", "Adjudicada a otro comité", "Bloqueada", "No aplica", "Revisar"] as const;
const configurationTypes = ["estado", "prioridad", "cargo", "posición"] as const;
const nullableText = z.string().max(5000).nullable().optional();
const safeText = z.string().trim().max(255).nullable().optional();
const passwordInput = z.string().min(8).max(128).refine(isPasswordValid, "La clave debe tener al menos 8 caracteres.");
const taskEditFields = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: nullableText,
  status: z.string().trim().min(2).max(64).optional(),
  priority: z.string().trim().min(2).max(32).optional(),
  dueDate: z.string().max(64).nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  categoryId: z.number().int().nullable().optional(),
});

function forbidden() { throw new TRPCError({ code: "FORBIDDEN", message: "Esta acción requiere permisos de organizador." }); }
function currentName(user: { name?: string | null; email?: string | null }) { return user.name || user.email || "Usuario"; }
async function roleFor(user: { openId?: string | null; email?: string | null; role: string }) { return db.getEffectiveRole(user); }

async function visibleTasks(eventId: number, user: { openId?: string | null; email?: string | null; name?: string | null; role: string }) {
  const role = await roleFor(user);
  if (isOrganizer(role)) return db.listTasks(eventId);
  const member = await db.getCurrentMember(user);
  if (!member || !member.active || role === "viewer") return [];
  return db.listAssignedTasks(eventId, member.id);
}

async function sendAutomaticNotice(recipients: string[], subject: string, body: string) {
  const smtp = await db.getSmtpSettings();
  if (!smtp || !recipients.length) return false;
  try { await sendSmtpMessage(smtp, recipients, subject, body); return true; }
  catch { return false; }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    localLogin: publicProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      await db.ensureSeedData();
      const member = await db.getMemberByCredentials(input.email, input.password);
      if (!member) throw new TRPCError({ code: "UNAUTHORIZED", message: "Correo o clave incorrectos." });
      const token = await createLocalSession(member.id);
      ctx.res.cookie(LOCAL_SESSION_COOKIE, token, { ...getSessionCookieOptions(ctx.req), sameSite: "none", maxAge: 12 * 60 * 60 * 1000 });
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...cookieOptions, sameSite: "none", maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  workspace: router({
    access: protectedProcedure.query(async ({ ctx }) => {
      await db.ensureSeedData(); const role = await roleFor(ctx.user);
      return { role, label: roleLabels[role] ?? "Colaborador/a", isOrganizer: isOrganizer(role), isLocalAccount: ctx.user.loginMethod === "local" };
    }),
    events: protectedProcedure.query(() => db.listEvents()),
    catalogs: protectedProcedure.query(() => db.listConfigurationItems()),
    overview: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => {
      const tasks = await visibleTasks(input.eventId, ctx.user);
      return { total: tasks.length, pending: tasks.filter(task => task.status === "Pendiente").length, active: tasks.filter(task => task.status === "En curso" || task.status === "Pendiente de verificación").length, done: tasks.filter(task => task.status === "Resuelta").length, awaitingReview: tasks.filter(task => task.status === "Pendiente de verificación").length, assigned: tasks.filter(task => task.status !== "Resuelta").slice(0, 8) };
    }),
    adminData: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden();
      const [categories, groups, allMembers, membershipRows, assignmentRows, tasks, configuration, verifications, documentAccess] = await Promise.all([
        db.listCategories(input.eventId), db.listGroups(input.eventId), db.listMembers(), db.listGroupMembers(), db.listTaskAssignments(), db.listTasks(input.eventId), db.listConfigurationItems(), db.listTaskVerifications((await db.listTasks(input.eventId)).map(task => task.id)), db.listDocumentAccess(),
      ]);
      const taskIds = tasks.map(task => task.id);
      return { categories, groups, members: allMembers.map(({ passwordHash, ...member }) => member), groupMembers: membershipRows.filter(row => groups.some(group => group.id === row.groupId)), taskAssignments: assignmentRows.filter(row => taskIds.includes(row.taskId)), configuration, verifications, documentAccess };
    }),
  }),

  tasks: router({
    list: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => visibleTasks(input.eventId, ctx.user)),
    verifications: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => {
      const tasks = await visibleTasks(input.eventId, ctx.user);
      return db.listTaskVerifications(tasks.map(task => task.id));
    }),
    pendingReviews: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!isOrganizer(role)) forbidden();
      const tasks = await db.listTasks(input.eventId); const reviews = await db.listTaskVerifications(tasks.map(task => task.id));
      return reviews.filter(review => review.status === "Pendiente").map(review => ({ ...review, task: tasks.find(task => task.id === review.taskId) }));
    }),
    create: protectedProcedure.input(z.object({ eventId: z.number().int(), categoryId: z.number().int().nullable().optional(), title: z.string().trim().min(1).max(500), description: nullableText, priority: z.string().trim().min(2).max(32).optional(), dueDate: z.string().max(64).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden();
      const categories = await db.listCategories(input.eventId); const category = categories.find(item => item.id === input.categoryId);
      await db.createTask({ eventId: input.eventId, categoryId: input.categoryId ?? null, externalId: `T-${Date.now()}`, title: input.title, description: input.description ?? null, priority: input.priority ?? "Media", dueDate: input.dueDate ?? null, phase: "Transversal", workBlock: category?.name ?? "Sin categoría", status: "Pendiente", progress: 0, localEligible: false });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), data: taskEditFields })).mutation(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.id); if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const role = await roleFor(ctx.user); const visible = await visibleTasks(task.eventId ?? 0, ctx.user); if (!visible.some(item => item.id === task.id)) forbidden();
      if ((input.data.status === "Resuelta" || input.data.status === "Pendiente de verificación") && input.data.status !== task.status) throw new TRPCError({ code: "BAD_REQUEST", message: "Las tareas terminadas deben enviarse y confirmarse desde el flujo de verificación." });
      const data = isOrganizer(role) ? input.data : { status: input.data.status === "Resuelta" || input.data.status === "Pendiente de verificación" ? undefined : input.data.status, progress: input.data.progress };
      await db.updateTask(input.id, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))); return { success: true };
    }),
    notes: protectedProcedure.input(z.object({ taskId: z.number().int() })).query(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.taskId); if (!task?.eventId) throw new TRPCError({ code: "NOT_FOUND" });
      const visible = await visibleTasks(task.eventId, ctx.user); if (!visible.some(item => item.id === task.id)) forbidden();
      return db.listTaskNotes(task.id);
    }),
    addNote: protectedProcedure.input(z.object({ taskId: z.number().int(), body: z.string().trim().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.taskId); if (!task?.eventId) throw new TRPCError({ code: "NOT_FOUND" });
      const visible = await visibleTasks(task.eventId, ctx.user); if (!visible.some(item => item.id === task.id)) forbidden();
      await db.addTaskNote({ taskId: task.id, authorName: currentName(ctx.user), body: input.body }); return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden();
      await db.deleteTaskSafely(input.id); return { success: true };
    }),
    submitVerification: protectedProcedure.input(z.object({ taskId: z.number().int(), note: z.string().trim().max(5000).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.taskId); if (!task || !task.eventId) throw new TRPCError({ code: "NOT_FOUND" });
      const visible = await visibleTasks(task.eventId, ctx.user); if (!visible.some(item => item.id === task.id)) forbidden();
      if (task.status === "Resuelta" || task.status === "Pendiente de verificación") throw new TRPCError({ code: "BAD_REQUEST", message: task.status === "Resuelta" ? "La tarea ya está confirmada como resuelta." : "La tarea ya está pendiente de verificación." });
      const member = await db.getCurrentMember(ctx.user);
      await db.createTaskVerification({ taskId: task.id, submittedByMemberId: member?.id ?? null, submittedByName: currentName(ctx.user), note: input.note ?? null, status: "Pendiente" });
      await db.updateTask(task.id, { status: "Pendiente de verificación", progress: 100 });
      const organizers = await db.getOrganizerRecipients();
      const noticeSent = await sendAutomaticNotice(organizers.map(person => person.email!).filter(Boolean), `Tarea pendiente de verificación · ${task.title}`, `${currentName(ctx.user)} ha marcado la tarea como completada y solicita su verificación.\n\nTarea: ${task.title}\n\nNota: ${input.note || "Sin nota adicional."}`);
      return { success: true, noticeSent };
    }),
    reviewVerification: protectedProcedure.input(z.object({ verificationId: z.number().int(), decision: z.enum(["confirm", "return"]), note: z.string().trim().max(5000).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!isOrganizer(role)) forbidden();
      const review = await db.getTaskVerification(input.verificationId); if (!review || review.status !== "Pendiente") throw new TRPCError({ code: "NOT_FOUND", message: "La solicitud de verificación ya no está disponible." });
      const task = await db.getTaskById(review.taskId); if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const confirmed = input.decision === "confirm";
      await db.reviewTaskVerification(review.id, { status: confirmed ? "Confirmada" : "Devuelta", reviewedByName: currentName(ctx.user), reviewerNote: input.note ?? null, reviewedAt: new Date() });
      await db.updateTask(task.id, { status: confirmed ? "Resuelta" : "En curso", progress: confirmed ? 100 : 90, actualClose: confirmed ? new Date().toLocaleDateString("es-ES") : null });
      const submitter = review.submittedByMemberId ? await db.getMemberById(review.submittedByMemberId) : undefined;
      const noticeSent = await sendAutomaticNotice(submitter?.email ? [submitter.email] : [], `${confirmed ? "Tarea confirmada" : "Tarea devuelta para revisión"} · ${task.title}`, `${currentName(ctx.user)} ha ${confirmed ? "confirmado" : "devuelto"} la verificación de la tarea.\n\nTarea: ${task.title}\n\nComentario: ${input.note || "Sin comentario adicional."}`);
      return { success: true, noticeSent };
    }),
    assign: protectedProcedure.input(z.object({ taskId: z.number().int(), memberIds: z.array(z.number().int()), groupIds: z.array(z.number().int()) })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.replaceTaskAssignments(input.taskId, input.memberIds, input.groupIds); return { success: true }; }),
  }),

  categories: router({
    create: protectedProcedure.input(z.object({ eventId: z.number().int(), name: z.string().trim().min(2).max(120), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.createCategory(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), name: z.string().trim().min(2).max(120).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); const { id, ...data } = input; await db.updateCategory(id, data); return { success: true }; }),
    remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); const affectedTasks = await db.deleteCategorySafely(input.id); return { success: true, affectedTasks }; }),
  }),

  members: router({
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(255), email: z.string().email().max(320), password: passwordInput, role: z.enum(["admin", "collaborator"]), jobTitle: safeText, position: safeText, organization: safeText, phone: safeText, notes: nullableText, committeeIds: z.array(z.number().int()).default([]) })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); const existing = await db.getMemberByEmail(input.email); if (existing?.passwordHash) throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cuenta local con este correo." });
      const { password, email, committeeIds, ...details } = input; const values = { ...details, email: email.trim().toLowerCase(), passwordHash: await hashPassword(password), committee: null, active: true };
      const memberId = existing ? existing.id : await db.createMember(values); if (existing) await db.updateMember(memberId, values);
      await db.replaceMemberCommittees(memberId, committeeIds); return { success: true };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), name: z.string().trim().min(2).max(255).optional(), email: z.string().email().max(320).optional(), password: passwordInput.optional(), role: z.enum(["admin", "collaborator"]).optional(), active: z.boolean().optional(), jobTitle: safeText, position: safeText, organization: safeText, phone: safeText, notes: nullableText, committeeIds: z.array(z.number().int()).optional() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); const { id, password, email, committeeIds, ...data } = input; await db.updateMember(id, { ...data, ...(email ? { email: email.trim().toLowerCase() } : {}), ...(password ? { passwordHash: await hashPassword(password) } : {}) }); if (committeeIds) await db.replaceMemberCommittees(id, committeeIds); return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden();
      const member = await db.getMemberById(input.id); if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "La persona ya no existe." });
      if (ctx.user.openId === `local:${input.id}`) throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes eliminar tu propia cuenta mientras tienes la sesión abierta." });
      try { await db.deleteMemberSafely(input.id); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "No se pudo eliminar la persona." }); }
      return { success: true };
    }),
  }),

  groups: router({
    create: protectedProcedure.input(z.object({ eventId: z.number().int(), name: z.string().trim().min(2).max(120), description: nullableText })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.createGroup(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), name: z.string().trim().min(2).max(120).optional(), description: nullableText })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); const { id, ...data } = input; await db.updateGroup(id, data); return { success: true }; }),
    setMembers: protectedProcedure.input(z.object({ groupId: z.number().int(), memberIds: z.array(z.number().int()) })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.replaceGroupMembers(input.groupId, input.memberIds); return { success: true }; }),
    remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.deleteGroupSafely(input.id); return { success: true }; }),
  }),

  events: router({
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(255), shortName: z.string().trim().min(2).max(80), location: safeText, startDate: z.string().max(32).nullable().optional(), endDate: z.string().max(32).nullable().optional() })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.createEvent({ ...input, status: "Planificación" }); return { success: true }; }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), name: z.string().trim().min(2).max(255).optional(), shortName: z.string().trim().min(2).max(80).optional(), location: safeText, startDate: z.string().max(32).nullable().optional(), endDate: z.string().max(32).nullable().optional(), status: z.string().max(32).optional() })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); const { id, ...data } = input; await db.updateEvent(id, data); return { success: true }; }),
  }),

  configuration: router({
    create: protectedProcedure.input(z.object({ type: z.enum(configurationTypes), name: z.string().trim().min(2).max(255), description: nullableText })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.createConfigurationItem(input); return { success: true }; }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), type: z.enum(configurationTypes).optional(), name: z.string().trim().min(2).max(255).optional(), description: nullableText })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); const { id, ...data } = input; await db.updateConfigurationItem(id, data); return { success: true }; }),
    remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.deleteConfigurationItem(input.id); return { success: true }; }),
  }),

  documents: router({
    list: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user);
      const all = await db.listDocuments(input.eventId);
      if (isOrganizer(role)) return all;
      const member = await db.getCurrentMember(ctx.user);
      return (await Promise.all(all.map(async document => {
        if (document.visibility === "Organizadores") return null;
        if (document.visibility !== "Asignados") return document;
        return member && await db.canMemberAccessDocument(document.id, member.id) ? document : null;
      }))).filter(Boolean);
    }),
    upload: protectedProcedure.input(z.object({ eventId: z.number().int(), title: z.string().trim().min(2).max(255), category: z.string().trim().min(2).max(120), visibility: z.enum(["Todos", "Comités", "Organizadores", "Asignados"]), fileName: z.string().trim().min(3).max(500), mimeType: z.string().trim().max(255).optional(), base64: z.string().min(4).max(14_000_000) })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!isOrganizer(role)) forbidden();
      let decoded: ReturnType<typeof decodeDocument>;
      try { decoded = decodeDocument(input.base64, input.fileName); }
      catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "No se pudo procesar el documento." }); }
      let stored: Awaited<ReturnType<typeof saveDocument>>;
      try {
        stored = await saveDocument(decoded.buffer, decoded.fileName);
      } catch (error) {
        console.error("[Documents] Error al guardar el archivo:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo escribir el archivo en el servidor. Revisa DOCUMENTS_DIRECTORY y los permisos de su carpeta." });
      }
      try {
        await db.createDocument({ eventId: input.eventId, title: input.title, category: input.category, visibility: input.visibility, fileName: decoded.fileName, mimeType: input.mimeType || "application/octet-stream", sizeBytes: decoded.buffer.length, storageKey: stored.key, url: stored.url, owner: currentName(ctx.user) });
      } catch (error) {
        console.error("[Documents] Error al registrar el documento:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "El archivo se guardó, pero no se pudo registrar en MySQL. Revisa la tabla documents." });
      }
      return { success: true };
    }),
    setAccess: protectedProcedure.input(z.object({ id: z.number().int(), visibility: z.enum(["Todos", "Comités", "Organizadores", "Asignados"]), memberIds: z.array(z.number().int()), groupIds: z.array(z.number().int()) })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!isOrganizer(role)) forbidden();
      if (input.visibility === "Asignados" && !input.memberIds.length && !input.groupIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecciona al menos una persona o un grupo." });
      await db.replaceDocumentAccess(input.id, input.memberIds, input.groupIds);
      await db.updateDocument(input.id, { visibility: input.visibility });
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!isOrganizer(role)) forbidden();
      await db.deleteDocument(input.id); return { success: true };
    }),
  }),

  messaging: router({
    smtp: protectedProcedure.query(async ({ ctx }) => { const role = await roleFor(ctx.user); if (!isOrganizer(role)) forbidden(); const settings = await db.getSmtpSettings(); return settings ? { id: settings.id, host: settings.host, port: settings.port, username: settings.username, fromName: settings.fromName, fromEmail: settings.fromEmail, secure: settings.secure, hasPassword: Boolean(settings.passwordEncrypted) } : null; }),
    saveSmtp: protectedProcedure.input(z.object({ host: z.string().trim().min(2).max(255), port: z.number().int().min(1).max(65535), username: z.string().trim().max(320).nullable().optional(), password: z.string().min(1).max(500).nullable().optional(), fromName: z.string().trim().min(2).max(255), fromEmail: z.string().email().max(320), secure: z.boolean() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!isOrganizer(role)) forbidden(); const current = await db.getSmtpSettings();
      if (!input.password && !current?.passwordEncrypted && input.username) throw new TRPCError({ code: "BAD_REQUEST", message: "Introduce la contraseña SMTP para guardar esta configuración." });
      await db.saveSmtpSettings({ host: input.host, port: input.port, username: input.username ?? null, passwordEncrypted: input.password ? encryptSecret(input.password) : current?.passwordEncrypted ?? null, fromName: input.fromName, fromEmail: input.fromEmail, secure: input.secure }); return { success: true };
    }),
    history: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => { const role = await roleFor(ctx.user); if (!isOrganizer(role)) forbidden(); return db.listEmailMessages(input.eventId); }),
    send: protectedProcedure.input(z.object({ eventId: z.number().int(), memberIds: z.array(z.number().int()), groupIds: z.array(z.number().int()), subject: z.string().trim().min(2).max(500), body: z.string().trim().min(1).max(20000) })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!isOrganizer(role)) forbidden(); const smtp = await db.getSmtpSettings(); if (!smtp) throw new TRPCError({ code: "BAD_REQUEST", message: "Configura el SMTP antes de enviar mensajes." });
      const recipients = await db.resolveMessageRecipients(input.memberIds, input.groupIds); const emails = recipients.map(member => member.email!).filter(Boolean);
      if (!emails.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Los destinatarios seleccionados no tienen correo activo." });
      try { await sendSmtpMessage(smtp, emails, input.subject, input.body); await db.addEmailMessage({ eventId: input.eventId, subject: input.subject, body: input.body, recipients: emails.join(", "), recipientCount: emails.length, createdBy: currentName(ctx.user), status: "Enviado", errorMessage: null }); return { success: true, recipientCount: emails.length }; }
      catch (error) { const message = error instanceof Error ? error.message : "Error SMTP desconocido"; await db.addEmailMessage({ eventId: input.eventId, subject: input.subject, body: input.body, recipients: emails.join(", "), recipientCount: emails.length, createdBy: currentName(ctx.user), status: "Error", errorMessage: message }); throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo enviar el correo. Revisa la configuración SMTP." }); }
    }),
  }),
});

export type AppRouter = typeof appRouter;
