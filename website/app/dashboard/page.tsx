import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import db from "@/lib/db";
import Nav from "@/components/Nav";

export default async function Dashboard() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const providerCount = (db.prepare("SELECT COUNT(*) n FROM providers WHERE user_id=?").get(user.id) as any).n;
  const modelCount = (db.prepare("SELECT COUNT(*) n FROM models WHERE user_id=?").get(user.id) as any).n;
  const deviceCount = (db.prepare("SELECT COUNT(*) n FROM devices WHERE user_id=?").get(user.id) as any).n;
  const settings = db.prepare("SELECT * FROM user_settings WHERE user_id=?").get(user.id) as any;
  const provider = settings?.selected_provider_id ? db.prepare("SELECT name FROM providers WHERE id=?").get(settings.selected_provider_id) as any : null;
  const model = settings?.selected_model_id ? db.prepare("SELECT display_name FROM models WHERE id=?").get(settings.selected_model_id) as any : null;

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
