import { NextResponse } from "next/server";
import { run } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { generateConnectorCredentials, hashPassword } from "@/lib/auth";

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const creds = generateConnectorCredentials();
  const hash = await hashPassword(creds.password);
  await run(
    "UPDATE users SET connector_username=?, connector_password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    [creds.username, hash, user.id]
  );
  return NextResponse.json({ ok: true, connector: creds });
}
