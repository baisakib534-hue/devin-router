import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(user.id) || {};
  return NextResponse.json({ settings, connectorUsername: user.connector_username });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const existing = db.prepare("SELECT user_id FROM user_settings WHERE user_id = ?").get(user.id);
  if (existing) {
    db.prepare("UPDATE user_settings SET selected_provider_id=?, selected_model_id=?, website_url=?, updated_at=datetime('now') WHERE user_id=?")
      .run(body.selectedProviderId || null, body.selectedModelId || null, body.websiteUrl || null, user.id);
  } else {
    db.prepare("INSERT INTO user_settings (user_id, selected_provider_id, selected_model_id, website_url) VALUES (?, ?, ?, ?)")
      .run(user.id, body.selectedProviderId || null, body.selectedModelId || null, body.websiteUrl || null);
  }
  return NextResponse.json({ ok: true });
}
