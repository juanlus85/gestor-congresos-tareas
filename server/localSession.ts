import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { ENV } from "./_core/env";

const encoder = new TextEncoder();
const ISSUER = "gestor-congresos-local";
const AUDIENCE = "gestor-congresos";
const developmentSecret = randomBytes(48).toString("base64url");

function secret() {
  const configuredSecret = ENV.cookieSecret.length >= 32 ? ENV.cookieSecret : (process.env.NODE_ENV !== "production" ? developmentSecret : ENV.cookieSecret);
  if (!configuredSecret || configuredSecret.length < 32) {
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres para las cuentas locales.");
  }
  return encoder.encode(configuredSecret);
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
