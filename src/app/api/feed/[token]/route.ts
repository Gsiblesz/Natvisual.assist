import { NextResponse } from "next/server";
import { calendarioIcs } from "@/lib/ics";
import { calendarioPorToken, listarTareas } from "@/lib/estudio";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const calendario = await calendarioPorToken(token);
  if (!calendario) {
    return NextResponse.json({ error: "Ese enlace ya no funciona." }, { status: 404 });
  }
  const tareas = (await listarTareas(calendario.cuenta_id)).filter((tarea) => tarea.fecha_entrega);
  const ics = calendarioIcs(
    tareas.map((tarea) => ({
      id: tarea.id,
      titulo: tarea.titulo,
      descripcion: tarea.descripcion,
      fecha_entrega: tarea.fecha_entrega as string,
      nombre_cliente: tarea.nombre_cliente,
    })),
    calendario.nombre_cliente,
  );
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${calendario.nombre_cliente.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics"`,
    },
  });
}
