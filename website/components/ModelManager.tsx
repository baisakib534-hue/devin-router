"use client";

import { useEffect, useState } from "react";

export default function ModelManager() {
  const [providers, setProviders] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function load() {
    const [p, m] = await Promise.all([
      fetch("/api/providers").then((r) => r.json()),
      fetch("/api/models").then((r) => r.json()),
    ]);
    setProviders(p.providers || []);
    setModels(m.models || []);
    if (!providerId && p.providers?.[0]) setProviderId(p.providers[0].id);
  }
  useEffect(() => { load(); }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, modelId, displayName }),
    });
    setModelId(""); setDisplayName("");
    await load();
  }

  async function setDefault(id: string) {
    await fetch("/api/models", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDefault: true }),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/models?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <form onSubmit={add} style={{ display: "grid", gap: 8, maxWidth: 480, marginBottom: 24 }}>
        <label>Provider
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} required>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Model ID<input value={modelId} onChange={(e) => setModelId(e.target.value)} required /></label>
        <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>
        <button type="submit">Add model</button>
      </form>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr><th style={{ textAlign: "left" }}>Provider</th><th style={{ textAlign: "left" }}>Model</th><th /></tr></thead>
        <tbody>{models.map((m) => (
          <tr key={m.id} style={{ borderTop: "1px solid #242a36" }}>
            <td style={{ padding: 8 }}>{m.provider_name}</td>
            <td style={{ padding: 8 }}>{m.display_name}{m.is_default ? " (default)" : ""}</td>
            <td style={{ padding: 8 }}>
              <button onClick={() => setDefault(m.id)}>Default</button>{" "}
              <button onClick={() => remove(m.id)}>Delete</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
