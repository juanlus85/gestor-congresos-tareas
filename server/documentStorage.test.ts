import { describe, expect, it } from "vitest";
import { decodeDocument } from "./documentStorage";

describe("Biblioteca documental", () => {
  it("acepta un PDF pequeño codificado en base64", () => {
    const payload = Buffer.from("contenido de prueba").toString("base64");
    const document = decodeDocument(`data:application/pdf;base64,${payload}`, "nota reunión.pdf");
    expect(document.buffer.toString()).toBe("contenido de prueba");
    expect(document.fileName).toBe("nota_reuni_n.pdf");
  });

  it("rechaza extensiones que puedan ejecutarse", () => {
    const payload = Buffer.from("alert(1)").toString("base64");
    expect(() => decodeDocument(payload, "script.js")).toThrow("Formato no permitido");
  });
});
