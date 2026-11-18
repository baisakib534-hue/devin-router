import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireConnector } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await requireConnector(req);
  if (!user) return NextResponse.json({ error: "Invalid connector credentials" }, { status: 401 });
  const body = await req.json();
  const { deviceId, providerName, model, status, durationMs } = body;
  db.prepare(`
    INSERT INTO request_logs (user_id, device_id, provider_name, model, status, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, deviceId || null, providerName || null, model || null, status || null, durationMs || null);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = await requireConnector(req);
  if (!user) return NextResponse.json({ error: "Invalid connector credentials" }, { status: 401 });
  const logs = db.prepare("SELECT * FROM request_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(user.id);
  return NextResponse.json({ logs });
}
