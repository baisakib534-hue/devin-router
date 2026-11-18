import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { generateConnectorCredentials, hashPassword } from "@/lib/auth";

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const creds = generateConnectorCredentials();
  const hash = await hashPassword(creds.password);
  db.prepare("UPDATE users SET connector_username=?, connector_password_hash=?, updated_at=datetime('now') WHERE id=?")
    .run(creds.username, hash, user.id);
  return NextResponse.json({ ok: true, connector: creds });
}
