import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = (await get("SELECT * FROM user_settings WHERE user_id = ?", [user.id])) || {};
  return NextResponse.json({ settings, connectorUsername: user.connector_username });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const existing = await get("SELECT user_id FROM user_settings WHERE user_id = ?", [user.id]);
  if (existing) {
    await run(
      "UPDATE user_settings SET selected_provider_id=?, selected_model_id=?, website_url=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
      [body.selectedProviderId || null, body.selectedModelId || null, body.websiteUrl || null, user.id]
    );
  } else {
    await run(
      "INSERT INTO user_settings (user_id, selected_provider_id, selected_model_id, website_url) VALUES (?, ?, ?, ?)",
      [user.id, body.selectedProviderId || null, body.selectedModelId || null, body.websiteUrl || null]
    );
  }
  return NextResponse.json({ ok: true });
}
