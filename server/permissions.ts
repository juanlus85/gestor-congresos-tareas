export const roleLabels: Record<string, string> = {
  admin: "Organizador administrador",
  direction: "Colaborador/a",
  collaborator: "Colaborador/a",
  user: "Colaborador/a",
  local_member: "Colaborador/a",
  scientific: "Colaborador/a",
  technical: "Colaborador/a",
  viewer: "Consulta",
};

export function isOrganizer(role: string) {
  return role === "admin";
}

export function canManageWorkspace(role: string) {
  return isOrganizer(role);
}
