import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

const encoder = new TextEncoder();
const ISSUER = "gestor-congresos-local";
const AUDIENCE = "gestor-congresos";

function secret() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres para las cuentas locales.");
  }
  return encoder.encode(ENV.cookieSecret);
}

export async function createLocalSession(memberId: number) {
  return new SignJWT({ authType: "local", memberId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(memberId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function readLocalSession(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE });
    if (payload.authType !== "local" || typeof payload.memberId !== "number") return null;
    return { memberId: payload.memberId };
  } catch {
    return null;
  }
}
