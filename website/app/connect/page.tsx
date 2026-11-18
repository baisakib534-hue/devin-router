import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { get } from "@/lib/db";
import Nav from "@/components/Nav";
import ConnectPanel from "@/components/ConnectPanel";

export default async function ConnectPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const settings = await get("SELECT * FROM user_settings WHERE user_id=?", [user.id]);
  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>Connect</h1>
      <Nav />
      <ConnectPanel username={user.connector_username} websiteUrl={settings?.website_url || "https://devin-router.uppcoder.com"} />
    </main>
  );
}
