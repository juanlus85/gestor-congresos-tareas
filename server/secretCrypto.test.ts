import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const previousSecret = process.env.JWT_SECRET;
const previousEnvironment = process.env.NODE_ENV;

beforeAll(() => {
  process.env.JWT_SECRET = "a".repeat(64);
  vi.resetModules();
});

afterAll(() => {
  process.env.JWT_SECRET = previousSecret;
  process.env.NODE_ENV = previousEnvironment;
});

describe("Credenciales SMTP", () => {
  it("cifra y recupera una contraseña sin guardarla visible", async () => {
    const { decryptSecret, encryptSecret } = await import("./secretCrypto");
    const encrypted = encryptSecret("ClaveSMTP2027");
    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain("ClaveSMTP2027");
    expect(decryptSecret(encrypted)).toBe("ClaveSMTP2027");
  });

  it("mantiene la capacidad de descifrar durante desarrollo con un JWT corto", async () => {
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "corta";
    vi.resetModules();
    const { decryptSecret, encryptSecret } = await import("./secretCrypto");
    const encrypted = encryptSecret("ClaveTemporal2027");
    expect(decryptSecret(encrypted)).toBe("ClaveTemporal2027");
  });
});
