import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import db from "@/lib/db";
import Nav from "@/components/Nav";
import ConnectPanel from "@/components/ConnectPanel";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const settings = db.prepare("SELECT * FROM user_settings WHERE user_id=?").get(user.id) as any;
  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>Settings</h1>
      <Nav />
      <h2>Connector</h2>
      <ConnectPanel username={user.connector_username} websiteUrl={settings?.website_url || "https://devin-router.uppcoder.com"} />
    </main>
  );
}
