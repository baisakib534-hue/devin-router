"use client";

import { useEffect, useState } from "react";

export default function ProviderManager() {
  const [providers, setProviders] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/providers");
    const data = await response.json();
    setProviders(data.providers || []);
  }
  useEffect(() => { load(); }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, baseUrl, apiKey }),
    });
    if (!response.ok) { setError((await response.json()).error); return; }
    setName(""); setBaseUrl(""); setApiKey("");
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/providers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <form onSubmit={add} style={{ display: "grid", gap: 8, maxWidth: 480, marginBottom: 24 }}>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Base URL<input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" required /></label>
        <label>API key<input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" required /></label>
        {error && <div style={{ color: "#ff8b8b" }}>{error}</div>}
        <button type="submit">Add provider</button>
      </form>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr><th style={{ textAlign: "left" }}>Name</th><th style={{ textAlign: "left" }}>Base URL</th><th /></tr></thead>
        <tbody>{providers.map((p) => (
          <tr key={p.id} style={{ borderTop: "1px solid #242a36" }}>
            <td style={{ padding: 8 }}>{p.name}</td>
            <td style={{ padding: 8 }}>{p.base_url}</td>
            <td style={{ padding: 8 }}><button onClick={() => remove(p.id)}>Delete</button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
