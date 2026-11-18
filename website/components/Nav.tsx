import Link from "next/link";

const links = [
  ["/dashboard", "Dashboard"],
  ["/providers", "Providers"],
  ["/models", "Models"],
  ["/connect", "Connect"],
  ["/devices", "Devices"],
  ["/logs", "Logs"],
  ["/settings", "Settings"],
];

export default function Nav() {
  return (
    <nav style={{ display: "flex", gap: 16, padding: 14, borderBottom: "1px solid #242a36", marginBottom: 24 }}>
      {links.map(([href, label]) => (
        <Link key={href} href={href} style={{ color: "#aab2c0", textDecoration: "none" }}>{label}</Link>
      ))}
      <form action="/api/auth/logout" method="post" style={{ marginLeft: "auto" }}>
        <button style={{ background: "transparent", border: "1px solid #3a4252", color: "#e1e4e8", padding: "6px 10px", borderRadius: 6, cursor: "pointer" }}>Log out</button>
      </form>
    </nav>
  );
}
