import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const logs = db.prepare("SELECT * FROM request_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 200").all(user.id);
  return NextResponse.json({ logs });
}
