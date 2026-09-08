import { describe, expect, it } from "vitest";
import { initialMembers, initialTasks } from "./seed";

describe("Matriz 7WP&OMC importada", () => {
  it("conserva las 152 tareas con códigos únicos", () => {
    expect(initialTasks).toHaveLength(152);
    expect(new Set(initialTasks.map(task => task.externalId)).size).toBe(152);
  });

  it("identifica el ámbito asignable al comité local", () => {
    const localTasks = initialTasks.filter(task => task.localEligible);
    expect(localTasks).toHaveLength(64);
    expect(new Set(localTasks.map(task => task.localWorkstream)).size).toBeGreaterThanOrEqual(7);
  });

  it("incluye las personas organizadoras iniciales", () => {
    expect(initialMembers.map(member => member.name)).toEqual(expect.arrayContaining([
      "Ana Irimia (Universidad Sevilla)",
      "Juan Luis Blanco",
      "Gema Berenguer",
    ]));
  });

  it("conserva los comités de trabajo de la matriz", () => {
    const committees = new Set(initialTasks.map(task => task.committee).filter(Boolean));
    expect([...committees]).toEqual(expect.arrayContaining([
      "Local Organizing Committee",
      "Comité Científico /ACEDEDOT",
      "Comité Ejecutivo  ACEDEDOT",
      "Comité de Comunicación Local",
      "Steering Committee 7WP&OMC",
      "Secretaría Técnica GRX",
      "Tesorería / Finanzas Local",
      "Program Committee Chairs",
      "ACEDEDOT",
    ]));
  });
});
