import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordValid, verifyPassword } from "./localAuth";

describe("Cuentas locales", () => {
  it("exige una clave con longitud, letras y números", () => {
    expect(isPasswordValid("corta1")).toBe(false);
    expect(isPasswordValid("sololetraslargas")).toBe(false);
    expect(isPasswordValid("ClaveSegura2027")).toBe(true);
  });

  it("almacena un hash verificable y no la clave en claro", async () => {
    const hash = await hashPassword("ClaveSegura2027");
    expect(hash).toMatch(/^scrypt:/);
    expect(hash).not.toContain("ClaveSegura2027");
    await expect(verifyPassword("ClaveSegura2027", hash)).resolves.toBe(true);
    await expect(verifyPassword("ClaveErronea999", hash)).resolves.toBe(false);
  });
});
