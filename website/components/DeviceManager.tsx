"use client";

import { useEffect, useState } from "react";

export default function DeviceManager() {
  const [devices, setDevices] = useState<any[]>([]);
  async function load() {
    const data = await fetch("/api/devices").then((r) => r.json());
    setDevices(data.devices || []);
  }
  useEffect(() => { load(); }, []);
  async function revoke(id: string) {
    await fetch("/api/devices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, revoked: true }),
    });
    await load();
  }
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead><tr><th style={{ textAlign: "left" }}>Name</th><th style={{ textAlign: "left" }}>Type</th><th style={{ textAlign: "left" }}>Last seen</th><th /></tr></thead>
      <tbody>{devices.map((d) => (
        <tr key={d.id} style={{ borderTop: "1px solid #242a36" }}>
          <td style={{ padding: 8 }}>{d.name}</td>
          <td style={{ padding: 8 }}>{d.device_type}</td>
          <td style={{ padding: 8 }}>{d.last_seen}</td>
          <td style={{ padding: 8 }}>{d.revoked ? "Revoked" : <button onClick={() => revoke(d.id)}>Revoke</button>}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
