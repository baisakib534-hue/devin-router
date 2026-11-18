import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { generateId } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const providers = db.prepare("SELECT * FROM providers WHERE user_id = ? ORDER BY created_at DESC").all(user.id);
  return NextResponse.json({ providers });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { name, baseUrl, apiKey, protocol } = body;
  if (!name || !baseUrl || !apiKey) {
    return NextResponse.json({ error: "name, baseUrl and apiKey required" }, { status: 400 });
  }
  const id = generateId();
  db.prepare(`INSERT INTO providers (id, user_id, name, base_url, api_key, protocol) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, user.id, name, baseUrl, apiKey, protocol || "openai-chat");
  return NextResponse.json({ ok: true, provider: { id, name, baseUrl, protocol: protocol || "openai-chat" } });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, name, baseUrl, apiKey, protocol } = body;
  const existing = db.prepare("SELECT id FROM providers WHERE id = ? AND user_id = ?").get(id, user.id) as any;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  db.prepare("UPDATE providers SET name=?, base_url=?, api_key=?, protocol=?, updated_at=datetime('now') WHERE id=?")
    .run(name, baseUrl, apiKey, protocol || "openai-chat", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  db.prepare("DELETE FROM providers WHERE id = ? AND user_id = ?").run(id, user.id);
  return NextResponse.json({ ok: true });
}
