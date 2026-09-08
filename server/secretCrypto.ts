import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ENV } from "./_core/env";

function encryptionKey() {
  const configuredSecret = ENV.cookieSecret.length >= 32 ? ENV.cookieSecret : "";
  const developmentSecret = process.env.NODE_ENV !== "production" ? `gestor-congresos-development-${ENV.appId || "local"}` : "";
  const material = configuredSecret || developmentSecret;
  if (!material) {
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres para cifrar la configuración SMTP.");
  }
  return createHash("sha256").update(material).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(value: string) {
  const [version, ivText, tagText, encryptedText] = value.split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) throw new Error("Configuración SMTP inválida.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8");
}
