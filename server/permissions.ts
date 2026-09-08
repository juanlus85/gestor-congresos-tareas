import type { ConferenceTask } from "../drizzle/schema";

export const roleLabels: Record<string, string> = {
  admin: "Administración",
  direction: "Dirección",
  local_member: "Comité local",
  scientific: "Comité científico",
  technical: "Secretaría técnica",
  collaborator: "Colaborador/a",
  viewer: "Consulta",
  user: "Usuario/a sin asignación",
};

export function isAdmin(role: string) {
  return role === "admin";
}

export function canManageMembers(role: string) {
  return role === "admin";
}

export function canManageStructure(role: string) {
  return role === "admin" || role === "direction";
}

export function canCreateTask(role: string) {
  return ["admin", "direction", "local_member", "scientific", "technical"].includes(role);
}

export function canViewTask(role: string, task: ConferenceTask, userName?: string | null) {
  if (["admin", "direction"].includes(role)) return true;
  if (role === "local_member") return task.localEligible;
  if (role === "scientific") {
    return task.phase.includes("Programa científico") || task.committee?.toLowerCase().includes("científico") || false;
  }
  if (role === "technical") {
    const committee = task.committee?.toLowerCase() || "";
    return committee.includes("secretaría") || ["Conferences", "Paper Proposals", "Users", "Documents", "Calendar"].includes(task.platformModule || "");
  }
  if (role === "collaborator" || role === "user") {
    const assignees = [task.responsible, task.coResponsible1, task.coResponsible2, task.support]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return Boolean(userName && assignees.includes(userName.toLowerCase()));
  }
  return false;
}

export function canEditTask(role: string, task: ConferenceTask, userName?: string | null) {
  if (["admin", "direction"].includes(role)) return true;
  if (["local_member", "scientific", "technical", "collaborator", "user"].includes(role)) {
    return canViewTask(role, task, userName);
  }
  return false;
}

export function canViewLocalBoard(role: string) {
  return ["admin", "direction", "local_member"].includes(role);
}

export function canViewFinance(role: string) {
  return ["admin", "direction"].includes(role);
}

export function canEditMeetings(role: string) {
  return ["admin", "direction", "local_member", "technical"].includes(role);
}

export function canEditDocuments(role: string) {
  return ["admin", "direction", "local_member", "scientific", "technical"].includes(role);
}
