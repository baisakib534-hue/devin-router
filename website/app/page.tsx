import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  
  if (session) {
    const payload = await verifySession(session);
    if (payload) redirect("/dashboard");
  }
  
  redirect("/login");
}
