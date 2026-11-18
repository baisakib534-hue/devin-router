import AuthForm from "@/components/AuthForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 900, margin: "80px auto", padding: 24 }}>
      <h1>Devin Router</h1>
      <p>Log in to manage providers, models, and devices.</p>
      <AuthForm mode="login" />
      <p style={{ marginTop: 20 }}>No account? <Link href="/signup" style={{ color: "#7aa2ff" }}>Sign up</Link></p>
    </main>
  );
}
