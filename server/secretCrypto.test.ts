import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const previousSecret = process.env.JWT_SECRET;

beforeAll(() => {
  process.env.JWT_SECRET = "a".repeat(64);
  vi.resetModules();
});

afterAll(() => {
  process.env.JWT_SECRET = previousSecret;
});

describe("Credenciales SMTP", () => {
  it("cifra y recupera una contraseña sin guardarla visible", async () => {
    const { decryptSecret, encryptSecret } = await import("./secretCrypto");
    const encrypted = encryptSecret("ClaveSMTP2027");
    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain("ClaveSMTP2027");
    expect(decryptSecret(encrypted)).toBe("ClaveSMTP2027");
  });
});
