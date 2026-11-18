import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "devin-router-dev-secret-change-in-production";
const key = new TextEncoder().encode(SESSION_SECRET);

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateConnectorCredentials() {
  return {
    username: `connector_${crypto.randomBytes(8).toString("hex")}`,
    password: crypto.randomBytes(24).toString("hex"),
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}
