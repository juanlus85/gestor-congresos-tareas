import { describe, expect, it } from "vitest";
import { findMemberWithPassword, hashPassword, isPasswordValid, verifyPassword } from "./localAuth";

describe("Cuentas locales", () => {
  it("acepta cualquier clave de ocho o más caracteres", () => {
    expect(isPasswordValid("corta1")).toBe(false);
    expect(isPasswordValid("sololetras")).toBe(true);
    expect(isPasswordValid("12345678")).toBe(true);
    expect(isPasswordValid("!#%&*?-_")).toBe(true);
  });

  it("almacena un hash verificable y no la clave en claro", async () => {
    const hash = await hashPassword("ClaveSegura2027");
    expect(hash).toMatch(/^scrypt:/);
    expect(hash).not.toContain("ClaveSegura2027");
    await expect(verifyPassword("ClaveSegura2027", hash)).resolves.toBe(true);
    await expect(verifyPassword("ClaveErronea999", hash)).resolves.toBe(false);
  });

  it("encuentra el perfil correcto si una importación duplicó el correo", async () => {
    const password = "ClaveSegura2027";
    const selected = await findMemberWithPassword([
      { id: 1, active: true, passwordHash: await hashPassword("OtraClave2027") },
      { id: 2, active: false, passwordHash: await hashPassword(password) },
      { id: 3, active: true, passwordHash: await hashPassword(password) },
    ], password);

    expect(selected?.id).toBe(3);
  });
});
