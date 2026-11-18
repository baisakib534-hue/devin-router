import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { generateId } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const providers = await all("SELECT * FROM providers WHERE user_id = ? ORDER BY created_at DESC", [user.id]);
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
  await run(
    `INSERT INTO providers (id, user_id, name, base_url, api_key, protocol) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, user.id, name, baseUrl, apiKey, protocol || "openai-chat"]
  );
  return NextResponse.json({ ok: true, provider: { id, name, baseUrl, protocol: protocol || "openai-chat" } });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, name, baseUrl, apiKey, protocol } = body;
  const existing = await get("SELECT id FROM providers WHERE id = ? AND user_id = ?", [id, user.id]);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await run(
    "UPDATE providers SET name=?, base_url=?, api_key=?, protocol=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    [name, baseUrl, apiKey, protocol || "openai-chat", id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  await run("DELETE FROM providers WHERE id = ? AND user_id = ?", [id, user.id]);
  return NextResponse.json({ ok: true });
}
