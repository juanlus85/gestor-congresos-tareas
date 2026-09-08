import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

describe("Cookies de sesión", () => {
  it("emite una cookie segura para solicitudes HTTPS tras Nginx", () => {
    const options = getSessionCookieOptions({ protocol: "http", headers: { "x-forwarded-proto": "https" } } as any);
    expect(options).toMatchObject({ httpOnly: true, path: "/", sameSite: "none", secure: true });
  });
});
