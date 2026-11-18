import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const devices = await all("SELECT * FROM devices WHERE user_id = ? ORDER BY connected_at DESC", [user.id]);
  return NextResponse.json({ devices });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { deviceId, name, deviceType } = await req.json();
  await run(`
    INSERT INTO devices (id, user_id, name, device_type)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen=CURRENT_TIMESTAMP, name=EXCLUDED.name
  `, [deviceId, user.id, name, deviceType || "windows"]);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, revoked } = await req.json();
  await run("UPDATE devices SET revoked=? WHERE id=? AND user_id=?", [revoked ? 1 : 0, id, user.id]);
  return NextResponse.json({ ok: true });
}
