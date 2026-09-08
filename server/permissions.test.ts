import { describe, expect, it } from "vitest";
import { canManageWorkspace, isOrganizer, roleLabels } from "./permissions";

describe("Permisos simplificados", () => {
  it("concede administración completa sólo a organizadores", () => {
    expect(isOrganizer("admin")).toBe(true);
    expect(isOrganizer("direction")).toBe(true);
    expect(isOrganizer("collaborator")).toBe(false);
    expect(isOrganizer("viewer")).toBe(false);
  });

  it("limita la gestión de personas, grupos y categorías", () => {
    expect(canManageWorkspace("admin")).toBe(true);
    expect(canManageWorkspace("collaborator")).toBe(false);
  });

  it("presenta etiquetas claras para los dos niveles de acceso", () => {
    expect(roleLabels.admin).toBe("Organizador administrador");
    expect(roleLabels.collaborator).toBe("Colaborador/a");
  });
});
