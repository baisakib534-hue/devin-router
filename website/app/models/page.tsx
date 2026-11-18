import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import Nav from "@/components/Nav";
import ModelManager from "@/components/ModelManager";

export default async function ModelsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>Models</h1>
      <Nav />
      <p>Add models from your providers and choose one as the default route.</p>
      <ModelManager />
    </main>
  );
}
