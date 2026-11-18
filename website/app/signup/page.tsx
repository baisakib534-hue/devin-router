import AuthForm from "@/components/AuthForm";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main style={{ maxWidth: 900, margin: "80px auto", padding: 24 }}>
      <h1>Devin Router</h1>
      <p>Create your local account. Connector credentials are generated for you.</p>
      <AuthForm mode="signup" />
      <p style={{ marginTop: 20 }}>Already have an account? <Link href="/login" style={{ color: "#7aa2ff" }}>Log in</Link></p>
    </main>
  );
}
