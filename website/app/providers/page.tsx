import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import Nav from "@/components/Nav";
import ProviderManager from "@/components/ProviderManager";

export default async function ProvidersPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>Providers</h1>
      <Nav />
      <p>Add OpenAI-compatible providers. API keys are stored locally in the website database.</p>
      <ProviderManager />
    </main>
  );
}
