import { describe, expect, it } from "vitest";
import { initialTasks } from "./seed";
import { canEditTask, canViewFinance, canViewLocalBoard, canViewTask } from "./permissions";

const localTask = initialTasks.find(task => task.localEligible)!;
const scientificTask = initialTasks.find(task => task.phase.includes("Programa científico"))!;

describe("Permisos de la plataforma", () => {
  it("limita el comité local a su ámbito operativo", () => {
    expect(canViewLocalBoard("local_member")).toBe(true);
    expect(canViewTask("local_member", localTask as any, "Ana Irimia")).toBe(true);
    expect(canViewTask("local_member", scientificTask as any, "Ana Irimia")).toBe(false);
  });

  it("restringe las finanzas a dirección y administración", () => {
    expect(canViewFinance("admin")).toBe(true);
    expect(canViewFinance("direction")).toBe(true);
    expect(canViewFinance("local_member")).toBe(false);
  });

  it("permite al colaborador editar únicamente una tarea asignada", () => {
    const assigned = { ...localTask, responsible: "Ana Irimia" };
    expect(canEditTask("collaborator", assigned as any, "Ana Irimia")).toBe(true);
    expect(canEditTask("collaborator", assigned as any, "Otra Persona")).toBe(false);
  });
});
