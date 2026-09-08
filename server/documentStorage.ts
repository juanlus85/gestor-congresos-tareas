import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".png", ".jpg", ".jpeg", ".webp"]);

function documentsDirectory() {
  return path.resolve(process.env.DOCUMENTS_DIRECTORY || path.join(process.cwd(), "storage", "documents"));
}

function safeFileName(fileName: string) {
  const base = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const extension = path.extname(base).toLowerCase();
  if (!base || !allowedExtensions.has(extension)) throw new Error("Formato no permitido. Usa PDF, Office, texto, CSV o imagen.");
  return base;
}

export function decodeDocument(base64: string, fileName: string) {
  const sanitized = base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(sanitized, "base64");
  if (!buffer.length || buffer.length > MAX_DOCUMENT_BYTES) throw new Error("El documento debe pesar entre 1 byte y 10 MB.");
  return { buffer, fileName: safeFileName(fileName) };
}

export async function saveDocument(buffer: Buffer, fileName: string) {
  const safeName = safeFileName(fileName);
  const directory = documentsDirectory();
  await mkdir(directory, { recursive: true });
  const key = `${Date.now()}-${randomUUID()}-${safeName}`;
  await writeFile(path.join(directory, key), buffer, { flag: "wx" });
  return { key, url: `/documentos/${encodeURIComponent(key)}` };
}

export async function readDocument(key: string) {
  const directory = documentsDirectory();
  const target = path.resolve(directory, path.basename(key));
  if (!target.startsWith(`${directory}${path.sep}`)) throw new Error("Documento no válido.");
  return readFile(target);
}

export function localDocumentPath(key: string) {
  const directory = documentsDirectory();
  const target = path.resolve(directory, path.basename(key));
  if (!target.startsWith(`${directory}${path.sep}`)) throw new Error("Documento no válido.");
  return target;
}
