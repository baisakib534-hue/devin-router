import { NextRequest, NextResponse } from "next/server";
import { requireConnector } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await requireConnector(req);
  if (!user) return NextResponse.json({ error: "Invalid connector credentials" }, { status: 401 });
  const body = await req.json();
  return NextResponse.json({ ok: true, userId: user.id, echo: body.message || "hello" });
}
