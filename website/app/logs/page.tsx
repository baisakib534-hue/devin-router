import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import db from "@/lib/db";
import Nav from "@/components/Nav";

export default async function LogsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const logs = db.prepare("SELECT * FROM request_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 200").all(user.id) as any[];
  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>Logs</h1>
      <Nav />
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr><th style={{ textAlign: "left" }}>Time</th><th style={{ textAlign: "left" }}>Provider</th><th style={{ textAlign: "left" }}>Model</th><th style={{ textAlign: "left" }}>Status</th><th style={{ textAlign: "left" }}>ms</th></tr></thead>
        <tbody>{logs.map((l) => (
          <tr key={l.id} style={{ borderTop: "1px solid #242a36" }}>
            <td style={{ padding: 8 }}>{l.created_at}</td>
            <td style={{ padding: 8 }}>{l.provider_name || "-"}</td>
            <td style={{ padding: 8 }}>{l.model || "-"}</td>
            <td style={{ padding: 8 }}>{l.status || "-"}</td>
            <td style={{ padding: 8 }}>{l.duration_ms ?? "-"}</td>
          </tr>
        ))}</tbody>
      </table>
    </main>
  );
}
