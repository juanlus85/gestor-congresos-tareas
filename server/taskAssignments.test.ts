import { describe, expect, it } from "vitest";
import { assignedTaskIdsForMember } from "./db";

describe("Coordinación de tareas", () => {
  const memberships = [
    { memberId: 10, groupId: 1 },
    { memberId: 11, groupId: 2 },
  ];
  const assignments = [
    { taskId: 100, memberId: 10, groupId: null },
    { taskId: 101, memberId: null, groupId: 1 },
    { taskId: 102, memberId: null, groupId: 2 },
  ];

  it("entrega a una persona las tareas directas y las de sus grupos", () => {
    expect([...assignedTaskIdsForMember(10, memberships, assignments)].sort()).toEqual([100, 101]);
  });

  it("no entrega tareas de grupos a los que la persona no pertenece", () => {
    expect([...assignedTaskIdsForMember(10, memberships, assignments)]).not.toContain(102);
  });
});
