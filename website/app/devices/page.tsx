import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import Nav from "@/components/Nav";
import DeviceManager from "@/components/DeviceManager";

export default async function DevicesPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>Devices</h1>
      <Nav />
      <DeviceManager />
    </main>
  );
}
