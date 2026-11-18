import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const logs = await all("SELECT * FROM request_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 200", [user.id]);
  return NextResponse.json({ logs });
}
