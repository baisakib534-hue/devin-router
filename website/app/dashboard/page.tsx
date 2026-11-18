import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { get } from "@/lib/db";
import Nav from "@/components/Nav";

export default async function Dashboard() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const providerCount = Number((await get("SELECT COUNT(*) n FROM providers WHERE user_id=?", [user.id]))?.n ?? 0);
  const modelCount = Number((await get("SELECT COUNT(*) n FROM models WHERE user_id=?", [user.id]))?.n ?? 0);
  const deviceCount = Number((await get("SELECT COUNT(*) n FROM devices WHERE user_id=?", [user.id]))?.n ?? 0);
  const settings = await get("SELECT * FROM user_settings WHERE user_id=?", [user.id]);
  const provider = settings?.selected_provider_id
    ? await get("SELECT name FROM providers WHERE id=?", [settings.selected_provider_id])
    : null;
  const model = settings?.selected_model_id
    ? await get("SELECT display_name FROM models WHERE id=?", [settings.selected_model_id])
    : null;

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>Devin Router</h1>
      <Nav />
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={card}><small>Providers</small><strong>{providerCount}</strong></div>
        <div style={card}><small>Models</small><strong>{modelCount}</strong></div>
        <div style={card}><small>Devices</small><strong>{deviceCount}</strong></div>
      </section>
      <section style={card}>
        <h2 style={{ marginTop: 0 }}>Active route</h2>
        <p>Provider: <strong>{provider?.name || "Not selected"}</strong></p>
        <p>Model: <strong>{model?.display_name || "Not selected"}</strong></p>
        <p>Website URL: <code>{settings?.website_url || "Not set"}</code></p>
      </section>
    </main>
  );
}

const card = { background: "#151a22", border: "1px solid #242a36", borderRadius: 10, padding: 18 };
