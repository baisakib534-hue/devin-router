import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireConnector } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await requireConnector(req);
  if (!user) return NextResponse.json({ error: "Invalid connector credentials" }, { status: 401 });
  const body = await req.json();
  const { deviceId, providerName, model, status, durationMs } = body;
  await run(`
    INSERT INTO request_logs (user_id, device_id, provider_name, model, status, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [user.id, deviceId || null, providerName || null, model || null, status || null, durationMs || null]);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = await requireConnector(req);
  if (!user) return NextResponse.json({ error: "Invalid connector credentials" }, { status: 401 });
  const logs = await all("SELECT * FROM request_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100", [user.id]);
  return NextResponse.json({ logs });
}
