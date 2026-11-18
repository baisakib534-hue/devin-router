import { NextRequest, NextResponse } from "next/server";
import { all, get, run, transaction } from "@/lib/db";
import { requireConnector } from "@/lib/session";
import { generateId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireConnector(req);
  if (!user) return NextResponse.json({ error: "Invalid connector credentials" }, { status: 401 });

  const providers = await all("SELECT * FROM providers WHERE user_id = ?", [user.id]);
  const models = await all("SELECT * FROM models WHERE user_id = ?", [user.id]);
  const settings = (await get("SELECT * FROM user_settings WHERE user_id = ?", [user.id])) || {};

  return NextResponse.json({ providers, models, settings });
}

export async function POST(req: NextRequest) {
  const user = await requireConnector(req);
  if (!user) return NextResponse.json({ error: "Invalid connector credentials" }, { status: 401 });

  const body = await req.json();

  if (body.providers) {
    await transaction(async (tx) => {
      await tx.run("DELETE FROM models WHERE user_id = ?", [user.id]);
      await tx.run("DELETE FROM providers WHERE user_id = ?", [user.id]);

      for (const provider of body.providers) {
        await tx.run(
          `
            INSERT INTO providers (id, user_id, name, base_url, api_key, protocol)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            provider.id || generateId(),
            user.id,
            provider.name,
            provider.baseUrl || provider.base_url,
            provider.apiKey || provider.api_key,
            provider.protocol || "openai-chat",
          ]
        );
      }

      for (const model of body.models || []) {
        const provider = await tx.get(
          "SELECT id FROM providers WHERE id=? AND user_id=?",
          [model.providerId, user.id]
        );
        if (!provider) continue;

        await tx.run(
          `
            INSERT INTO models (id, provider_id, user_id, model_id, display_name, is_default)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            model.id || generateId(),
            model.providerId,
            user.id,
            model.modelId,
            model.displayName,
            model.isDefault ? 1 : 0,
          ]
        );
      }
    });
  }

  if (body.settings) {
    const existing = await get("SELECT user_id FROM user_settings WHERE user_id = ?", [user.id]);
    if (existing) {
      await run(
        "UPDATE user_settings SET selected_provider_id=?, selected_model_id=?, website_url=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
        [
          body.settings.selectedProviderId || null,
          body.settings.selectedModelId || null,
          body.settings.websiteUrl || null,
          user.id,
        ]
      );
    } else {
      await run(
        "INSERT INTO user_settings (user_id, selected_provider_id, selected_model_id, website_url) VALUES (?, ?, ?, ?)",
        [
          user.id,
          body.settings.selectedProviderId || null,
          body.settings.selectedModelId || null,
          body.settings.websiteUrl || null,
        ]
      );
    }
  }

  return NextResponse.json({ ok: true });
}
