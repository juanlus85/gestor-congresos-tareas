import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { canManageWorkspace, isOrganizer, roleLabels } from "./permissions";

const nullableText = z.string().max(5000).nullable().optional();
const taskEditFields = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: nullableText,
  status: z.enum(["Pendiente", "En curso", "Resuelta", "Bloqueada"]).optional(),
  priority: z.enum(["Alta", "Media", "Baja"]).optional(),
  dueDate: z.string().max(64).nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  categoryId: z.number().int().nullable().optional(),
});

function forbidden() { throw new TRPCError({ code: "FORBIDDEN", message: "Esta acción requiere permisos de organizador." }); }
async function roleFor(user: { email?: string | null; role: string }) { return db.getEffectiveRole(user); }

async function visibleTasks(eventId: number, user: { email?: string | null; name?: string | null; role: string }) {
  const role = await roleFor(user);
  if (isOrganizer(role)) return db.listTasks(eventId);
  const member = await db.getCurrentMember(user);
  if (!member || !member.active || role === "viewer") return [];
  return db.listAssignedTasks(eventId, member.id);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  workspace: router({
    access: protectedProcedure.query(async ({ ctx }) => {
      await db.ensureSeedData();
      const role = await roleFor(ctx.user);
      return { role, label: roleLabels[role] ?? "Colaborador/a", isOrganizer: isOrganizer(role) };
    }),
    events: protectedProcedure.query(() => db.listEvents()),
    overview: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => {
      const tasks = await visibleTasks(input.eventId, ctx.user);
      return {
        total: tasks.length,
        pending: tasks.filter(task => task.status === "Pendiente").length,
        active: tasks.filter(task => task.status === "En curso").length,
        done: tasks.filter(task => task.status === "Resuelta").length,
        assigned: tasks.slice(0, 8),
      };
    }),
    adminData: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user);
      if (!canManageWorkspace(role)) forbidden();
      const [categories, groups, allMembers, membershipRows, assignmentRows, tasks] = await Promise.all([
        db.listCategories(input.eventId), db.listGroups(input.eventId), db.listMembers(), db.listGroupMembers(), db.listTaskAssignments(), db.listTasks(input.eventId),
      ]);
      const taskIds = tasks.map(task => task.id);
      return {
        categories,
        groups,
        members: allMembers,
        groupMembers: membershipRows.filter(row => groups.some(group => group.id === row.groupId)),
        taskAssignments: assignmentRows.filter(row => taskIds.includes(row.taskId)),
      };
    }),
  }),

  tasks: router({
    list: protectedProcedure.input(z.object({ eventId: z.number().int() })).query(async ({ ctx, input }) => visibleTasks(input.eventId, ctx.user)),
    create: protectedProcedure.input(z.object({
      eventId: z.number().int(), categoryId: z.number().int().nullable().optional(), title: z.string().trim().min(1).max(500),
      description: nullableText, priority: z.enum(["Alta", "Media", "Baja"]).optional(), dueDate: z.string().max(64).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden();
      const categories = await db.listCategories(input.eventId);
      const category = categories.find(item => item.id === input.categoryId);
      await db.createTask({
        eventId: input.eventId, categoryId: input.categoryId ?? null, externalId: `T-${Date.now()}`, title: input.title,
        description: input.description ?? null, priority: input.priority ?? "Media", dueDate: input.dueDate ?? null,
        phase: "General", workBlock: category?.name ?? "Sin categoría", status: "Pendiente", progress: 0, localEligible: false,
      });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), data: taskEditFields })).mutation(async ({ ctx, input }) => {
      const task = await db.getTaskById(input.id); if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const role = await roleFor(ctx.user);
      const visible = await visibleTasks(task.eventId ?? 0, ctx.user);
      if (!visible.some(item => item.id === task.id)) forbidden();
      const data = isOrganizer(role) ? input.data : { status: input.data.status, progress: input.data.progress };
      const cleaned = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
      await db.updateTask(input.id, cleaned);
      return { success: true };
    }),
    assign: protectedProcedure.input(z.object({ taskId: z.number().int(), memberIds: z.array(z.number().int()), groupIds: z.array(z.number().int()) })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden();
      await db.replaceTaskAssignments(input.taskId, input.memberIds, input.groupIds);
      return { success: true };
    }),
  }),

  events: router({
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(255), shortName: z.string().trim().min(2).max(80), location: z.string().max(255).nullable().optional(), startDate: z.string().max(32).nullable().optional(), endDate: z.string().max(32).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden();
      await db.createEvent({ ...input, status: "Planificación" }); return { success: true };
    }),
  }),

  categories: router({
    create: protectedProcedure.input(z.object({ eventId: z.number().int(), name: z.string().trim().min(2).max(120), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden();
      await db.createCategory(input); return { success: true };
    }),
  }),

  members: router({
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(255), email: z.string().email().max(320).nullable().optional(), role: z.enum(["admin", "collaborator"]), position: z.string().max(255).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden();
      await db.createMember({ ...input, committee: null, active: true }); return { success: true };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), name: z.string().trim().min(2).max(255).optional(), email: z.string().email().max(320).nullable().optional(), role: z.enum(["admin", "collaborator"]).optional(), active: z.boolean().optional(), position: z.string().max(255).nullable().optional() })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); const { id, ...data } = input;
      await db.updateMember(id, data); return { success: true };
    }),
  }),

  groups: router({
    create: protectedProcedure.input(z.object({ eventId: z.number().int(), name: z.string().trim().min(2).max(120), description: nullableText })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.createGroup(input); return { success: true };
    }),
    setMembers: protectedProcedure.input(z.object({ groupId: z.number().int(), memberIds: z.array(z.number().int()) })).mutation(async ({ ctx, input }) => {
      const role = await roleFor(ctx.user); if (!canManageWorkspace(role)) forbidden(); await db.replaceGroupMembers(input.groupId, input.memberIds); return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
