import { NextResponse } from "next/server";
import { isAdmin } from "./auth";
import { EstudioError } from "./estudio";

export async function guard() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}

export async function run(fn: () => Promise<unknown>) {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json(await fn());
  } catch (error) {
    if (error instanceof EstudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
}

export function origen(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export function cuentaIdDe(request: Request) {
  const valor = new URL(request.url).searchParams.get("cuenta_id");
  if (!valor || valor === "todas") return null;
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}
