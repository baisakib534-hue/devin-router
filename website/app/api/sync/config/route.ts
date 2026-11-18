import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requireConnector } from "@/lib/session";
import { generateId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireConnector(req);
  if (!user) return NextResponse.json({ error: "Invalid connector credentials" }, { status: 401 });
  const providers = db.prepare("SELECT * FROM providers WHERE user_id = ?").all(user.id);
  const models = db.prepare("SELECT * FROM models WHERE user_id = ?").all(user.id);
  const settings = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(user.id) || {};
  return NextResponse.json({ providers, models, settings });
}

export async function POST(req: NextRequest) {
  const user = await requireConnector(req);
  if (!user) return NextResponse.json({ error: "Invalid connector credentials" }, { status: 401 });
  const body = await req.json();
  if (body.providers) {
    db.transaction(() => {
      db.prepare("DELETE FROM models WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM providers WHERE user_id = ?").run(user.id);
      for (const p of body.providers) {
        db.prepare(`
          INSERT INTO providers (id, user_id, name, base_url, api_key, protocol)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(p.id || generateId(), user.id, p.name, p.baseUrl || p.base_url, p.apiKey || p.api_key, p.protocol || "openai-chat");
      }
      for (const m of body.models || []) {
        const provider = db.prepare("SELECT id FROM providers WHERE id=? AND user_id=?").get(m.providerId, user.id) as any;
        if (!provider) continue;
        db.prepare(`
          INSERT INTO models (id, provider_id, user_id, model_id, display_name, is_default)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(m.id || generateId(), m.providerId, user.id, m.modelId, m.displayName, m.isDefault ? 1 : 0);
      }
    })();
  }
  if (body.settings) {
    const existing = db.prepare("SELECT user_id FROM user_settings WHERE user_id = ?").get(user.id);
    if (existing) {
      db.prepare("UPDATE user_settings SET selected_provider_id=?, selected_model_id=?, website_url=?, updated_at=datetime('now') WHERE user_id=?")
        .run(body.settings.selectedProviderId || null, body.settings.selectedModelId || null, body.settings.websiteUrl || null, user.id);
    } else {
      db.prepare("INSERT INTO user_settings (user_id, selected_provider_id, selected_model_id, website_url) VALUES (?, ?, ?, ?)")
        .run(user.id, body.settings.selectedProviderId || null, body.settings.selectedModelId || null, body.settings.websiteUrl || null);
    }
  }
  return NextResponse.json({ ok: true });
}
