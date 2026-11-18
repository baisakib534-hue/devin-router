import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/session";
import { generateId } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const models = db.prepare(`
    SELECT m.*, p.name as provider_name
    FROM models m JOIN providers p ON p.id = m.provider_id
    WHERE m.user_id = ? ORDER BY m.created_at DESC
  `).all(user.id);
  return NextResponse.json({ models });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { providerId, modelId, displayName } = body;
  if (!providerId || !modelId || !displayName) {
    return NextResponse.json({ error: "providerId, modelId and displayName required" }, { status: 400 });
  }
  const provider = db.prepare("SELECT id FROM providers WHERE id = ? AND user_id = ?").get(providerId, user.id) as any;
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  const id = generateId();
  db.prepare(`INSERT INTO models (id, provider_id, user_id, model_id, display_name) VALUES (?, ?, ?, ?, ?)`)
    .run(id, providerId, user.id, modelId, displayName);
  return NextResponse.json({ ok: true, model: { id, providerId, modelId, displayName } });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, displayName, isDefault } = body;
  if (isDefault) db.prepare("UPDATE models SET is_default=0 WHERE user_id=?").run(user.id);
  db.prepare("UPDATE models SET display_name=?, is_default=?, updated_at=datetime('now') WHERE id=? AND user_id=?")
    .run(displayName, isDefault ? 1 : 0, id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  db.prepare("DELETE FROM models WHERE id = ? AND user_id = ?").run(searchParams.get("id"), user.id);
  return NextResponse.json({ ok: true });
}
