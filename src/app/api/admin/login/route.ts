import { NextResponse } from "next/server";
import { authConfigured, passwordOk, sessionCookie, signSession } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ required: authConfigured() });
}

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: "Este estudio no usa contraseña." }, { status: 400 });
  }
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
