import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import {
  canCreateTask,
  canEditDocuments,
  canEditMeetings,
  canEditTask,
  canManageMembers,
  canManageStructure,
  canViewFinance,
  canViewLocalBoard,
  canViewTask,
  roleLabels,
} from "./permissions";

const nullableText = z.string().max(5000).nullable().optional();
const taskFields = z.object({
  externalId: z.string().min(1).max(32),
  phase: z.string().min(1).max(120),
  workBlock: z.string().min(1).max(120),
  title: z.string().min(1).max(500),
  description: nullableText,
  observations: nullableText,
  status: z.string().max(64).optional(),
  committee: z.string().max(255).nullable().optional(),
  responsible: z.string().max(255).nullable().optional(),
  coResponsible1: z.string().max(255).nullable().optional(),
  coResponsible2: z.string().max(255).nullable().optional(),
  support: z.string().max(255).nullable().optional(),
  priority: z.string().max(32).optional(),
  scope: z.string().max(255).nullable().optional(),
  platformModule: z.string().max(80).nullable().optional(),
  team: z.string().max(255).nullable().optional(),
  plannedStart: z.string().max(64).nullable().optional(),
  dueDate: z.string().max(64).nullable().optional(),
  actualClose: z.string().max(64).nullable().optional(),
  deliverable: nullableText,
  dependencies: nullableText,
  risk: nullableText,
  decisionRequired: nullableText,
  assignedAtMeeting: nullableText,
  costEstimate: z.string().max(64).nullable().optional(),
  costActual: z.string().max(64).nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  localEligible: z.boolean().optional(),
  localWorkstream: z.string().max(120).nullable().optional(),
});

function forbidden() {
  throw new TRPCError({ code: "FORBIDDEN", message: "No dispone de permiso para esta acción." });
}

async function roleFor(user: { email?: string | null; role: string }) {
  return db.getEffectiveRole(user);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  workspace: router({
    access: protectedProcedure.query(async ({ ctx }) => {
      const role = await roleFor(ctx.user);
      return { role, label: roleLabels[role] ?? roleLabels.viewer };
    }),
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const role = await roleFor(ctx.user);
      const allTasks = await db.listTasks();
      const visible = allTasks.filter(task => canViewTask(role, task, ctx.user.name));
      const local = allTasks.filter(task => task.localEligible);
      return {
        role,
        taskCount: visible.length,
        pending: visible.filter(task => task.status === "Pendiente").length,
        inProgress: visible.filter(task => task.status === "En curso").length,
        resolved: visible.filter(task => task.status === "Resuelta").length,
        highPriority: visible.filter(task => task.priority === "Alta" && task.status !== "Resuelta").length,
        decisions: visible.filter(task => task.decisionRequired).length,
        blocks: Array.from(new Set(visible.map(task => task.workBlock))).length,
        localCount: local.length,
        nextTasks: visible.filter(task => task.status !== "Resuelta").slice(0, 6),
      };
    }),
    localSummary: protectedProcedure.query(async ({ ctx }) => {
      const role = await roleFor(ctx.user);
      if (!canViewLocalBoard(role)) forbidden();
      const tasks = (await db.listTasks()).filter(task => task.localEligible);
      const grouped = Object.entries(
        tasks.reduce<Record<string, typeof tasks>>((acc, task) => {
          const key = task.localWorkstream ?? "Coordinación local";
          acc[key] = [...(acc[key] ?? []), task];
          return acc;
        }, {})
      ).map(([name, entries]) => ({
        name,
        total: entries.length,
        pending: entries.filter(task => task.status === "Pendiente").length,
        active: entries.filter(task => task.status === "En curso").length,
        done: entries.filter(task => task.status === "Resuelta").length,
        high: entries.filter(task => task.priority === "Alta" && task.status !== "Resuelta").length,
        tasks: entries,
      })).sort((a, b) => b.high - a.high || b.total - a.total);
      return { total: tasks.length, groups: grouped };
    }),
  }),

  tasks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const role = await roleFor(ctx.user);
      const all = await db.listTasks();
      return all.filter(task => canViewTask(role, task, ctx.user.name));
    }),
    detail: protectedProcedure.input(z.object({ id: z.number().int() })).query(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const role = await roleFor(ctx.user);
      if (!canViewTask(role, task, ctx.user.name)) forbidden();
      return task;
    }),
    create: protectedProcedure.input(taskFields).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user);
      if (!canCreateTask(role)) forbidden();
      await db.createTask({
        ...input,
        status: input.status ?? "Pendiente",
        priority: input.priority ?? "Media",
        progress: input.progress ?? 0,
        localEligible: input.localEligible ?? false,
      });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), data: taskFields.partial() })).mutation(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const role = await roleFor(ctx.user);
      if (!canEditTask(role, task, ctx.user.name)) forbidden();
      const updated = await db.updateTask(input.id, input.data);
      return updated;
    }),
    notes: protectedProcedure.input(z.object({ taskId: z.number().int() })).query(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.taskId);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const role = await roleFor(ctx.user);
      if (!canViewTask(role, task, ctx.user.name)) forbidden();
      return db.listTaskNotes(input.taskId);
    }),
    addNote: protectedProcedure.input(z.object({ taskId: z.number().int(), body: z.string().trim().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.taskId);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const role = await roleFor(ctx.user);
      if (!canEditTask(role, task, ctx.user.name)) forbidden();
      await db.addTaskNote({ taskId: input.taskId, authorName: ctx.user.name ?? "Usuario", body: input.body });
      return { success: true };
    }),
  }),

  members: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const role = await roleFor(ctx.user);
      const records = await db.listMembers();
      return canManageMembers(role) ? records : records.map(({ email, ...member }) => member);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().trim().min(2).max(255),
      email: z.string().email().max(320).nullable().optional(),
      role: z.enum(["admin", "direction", "local_member", "scientific", "technical", "collaborator", "viewer"]),
      committee: z.string().max(255).nullable().optional(),
      position: z.string().max(255).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user);
      if (!canManageMembers(role)) forbidden();
      await db.createMember({ ...input, active: true });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number().int(),
      email: z.string().email().max(320).nullable().optional(),
      role: z.enum(["admin", "direction", "local_member", "scientific", "technical", "collaborator", "viewer"]).optional(),
      committee: z.string().max(255).nullable().optional(),
      position: z.string().max(255).nullable().optional(),
      active: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user);
      if (!canManageMembers(role)) forbidden();
      const { id, ...data } = input;
      await db.updateMember(id, data);
      return { success: true };
    }),
  }),

  meetings: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const role = await roleFor(ctx.user);
      const records = await db.listMeetings();
      if (["admin", "direction"].includes(role)) return records;
      if (role === "local_member") return records.filter(record => record.committee.toLowerCase().includes("local"));
      if (role === "scientific") return records.filter(record => record.committee.toLowerCase().includes("científico"));
      if (role === "technical") return records.filter(record => record.committee.toLowerCase().includes("secretaría"));
      forbidden();
    }),
    create: protectedProcedure.input(z.object({
      title: z.string().min(2).max(255),
      scheduledAt: z.string().min(4).max(64),
      committee: z.string().min(2).max(255),
      agenda: nullableText,
      notes: nullableText,
      status: z.string().max(32).optional(),
    })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user);
      if (!canEditMeetings(role)) forbidden();
      await db.createMeeting({ ...input, status: input.status ?? "Planificada" });
      return { success: true };
    }),
  }),

  documents: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const role = await roleFor(ctx.user);
      const records = await db.listDocuments();
      if (["admin", "direction", "local_member", "scientific", "technical"].includes(role)) return records;
      return records.filter(record => record.visibility === "Todos");
    }),
    create: protectedProcedure.input(z.object({
      title: z.string().min(2).max(255),
      category: z.string().min(2).max(120),
      url: z.string().url().nullable().optional(),
      owner: z.string().max(255).nullable().optional(),
      visibility: z.string().max(32).optional(),
    })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user);
      if (!canEditDocuments(role)) forbidden();
      await db.createDocument({ ...input, visibility: input.visibility ?? "Comités" });
      return { success: true };
    }),
  }),

  finance: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const role = await roleFor(ctx.user);
      if (!canViewFinance(role)) forbidden();
      const tasks = await db.listTasks();
      return tasks.filter(task => task.workBlock === "Finanzas");
    }),
  }),

  governance: router({
    canManage: protectedProcedure.query(async ({ ctx }) => {
      const role = await roleFor(ctx.user);
      return { canManage: canManageStructure(role) };
    }),
  }),
});

export type AppRouter = typeof appRouter;
