import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fechaEnCaracas } from "@/lib/fechas";
import { enviarATodos, resumenDeHoy } from "@/lib/push";

export const dynamic = "force-dynamic";

// Vercel llama esta ruta una vez al día (vercel.json).
// Si existe CRON_SECRET, solo Vercel puede llamarla. Si no, igual manda como máximo un resumen al día.
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET?.trim();
  if (secreto && request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const hoy = fechaEnCaracas();
    const tomado = await sql<{ clave: string }>(
      `insert into ajustes (clave, valor) values ('resumen_ultimo', $1)
       on conflict (clave) do update set valor = excluded.valor
       where ajustes.valor <> excluded.valor
       returning clave`,
      [hoy],
    );
    if (!tomado.length) return NextResponse.json({ ok: true, motivo: "El resumen de hoy ya salió." });
    const resultado = await enviarATodos(await resumenDeHoy());
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo mandar el resumen." }, { status: 500 });
  }
}
