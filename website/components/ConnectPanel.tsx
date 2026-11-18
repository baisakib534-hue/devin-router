"use client";

import { useState } from "react";

export default function ConnectPanel({ username, websiteUrl }: { username: string; websiteUrl: string }) {
  const [connector, setConnector] = useState<{ username: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function rotate() {
    setBusy(true);
    const response = await fetch("/api/settings/connector", { method: "POST" });
    const data = await response.json();
    setBusy(false);
    if (response.ok) setConnector(data.connector);
  }

  return (
    <div>
      <p>Connector username: <code>{username}</code></p>
      <p>Website URL: <code>{websiteUrl}</code></p>
      <p>Use these in the local app login screen.</p>
      {connector && (
        <pre style={{ whiteSpace: "pre-wrap", background: "#161b24", padding: 16, borderRadius: 8 }}>
          Username: {connector.username}{"\n"}Password: {connector.password}
        </pre>
      )}
      <button onClick={rotate} disabled={busy}>{busy ? "Generating..." : "Generate new connector password"}</button>
    </div>
  );
}
