"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [connector, setConnector] = useState<{ username: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Request failed");
      return;
    }
    if (mode === "signup" && data.connector) setConnector(data.connector);
    else router.push("/dashboard");
  }

  if (connector) {
    return (
      <div>
        <h2>Account created</h2>
        <p>Save these connector credentials. The local app uses them to sync.</p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#161b24", padding: 16, borderRadius: 8 }}>
          Username: {connector.username}{"\n"}Password: {connector.password}
        </pre>
        <button onClick={() => router.push("/dashboard")} style={{ marginTop: 12 }}>Continue to dashboard</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
      <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} required /></label>
      {error && <div style={{ color: "#ff8b8b" }}>{error}</div>}
      <button disabled={busy} type="submit">{busy ? "Working..." : mode === "signup" ? "Create account" : "Log in"}</button>
    </form>
  );
}
