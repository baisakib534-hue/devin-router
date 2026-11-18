import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import db from "./db";
import { verifySession, verifyPassword } from "./auth";

export async function requireUser() {
  const store = await cookies();
  const token = store.get("session")?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  return db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId) as any || null;
}

export async function requireConnector(req: NextRequest) {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  const user = db.prepare("SELECT * FROM users WHERE connector_username = ?").get(username) as any;
  if (!user || !(await verifyPassword(password, user.connector_password_hash))) return null;
  return user;
}

export function requireUserOrRedirect() {
  return requireUser();
}
