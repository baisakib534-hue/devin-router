import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { hashPassword, verifyPassword, createSession, generateConnectorCredentials, generateId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    
    if (!email || !password || password.length < 8) {
      return NextResponse.json({ error: "Email and password (min 8 chars) required" }, { status: 400 });
    }
    
    // Check if user exists
    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }
    
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const creds = generateConnectorCredentials();
    const connectorHash = await hashPassword(creds.password);
    
    await run(`
      INSERT INTO users (id, email, password_hash, connector_username, connector_password_hash)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, email, passwordHash, creds.username, connectorHash]);
    
    const token = await createSession({ userId, email });
    
    const response = NextResponse.json({
      ok: true,
      connector: { username: creds.username, password: creds.password },
    });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (e) {
    console.error("Signup error:", e);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
