import { NextResponse } from "next/server";
import { passwordOk, sessionCookie, signSession, usingDemoPassword } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ demo: usingDemoPassword() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (!passwordOk(String(body.password ?? ""))) {
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }
  const token = signSession();
  const cookie = sessionCookie(token);
  const response = NextResponse.json({ token, role: "admin" });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
