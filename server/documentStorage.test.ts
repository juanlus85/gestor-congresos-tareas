import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { decodeDocument, readDocument, saveDocument } from "./documentStorage";

const originalDirectory = process.env.DOCUMENTS_DIRECTORY;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  process.env.DOCUMENTS_DIRECTORY = originalDirectory;
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

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

  it("crea la carpeta configurada y conserva el archivo", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "congreso-documentos-"));
    temporaryDirectories.push(directory);
    process.env.DOCUMENTS_DIRECTORY = path.join(directory, "biblioteca");
    const stored = await saveDocument(Buffer.from("acta"), "acta.pdf");
    expect(stored.url).toMatch(/^\/documentos\//);
    await expect(readDocument(stored.key)).resolves.toEqual(Buffer.from("acta"));
  });
});
