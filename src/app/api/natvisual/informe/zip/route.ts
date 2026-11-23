import JSZip from "jszip";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { armarInforme, csv, EstudioError } from "@/lib/estudio";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      cuenta_id?: number | null;
      anio?: number;
      mes?: number;
      purgar?: boolean;
    };
    const cuentaId =
      body.cuenta_id == null || Number(body.cuenta_id) <= 0 ? null : Number(body.cuenta_id);
    const paquete = await armarInforme(
      cuentaId,
      Number(body.anio),
      Number(body.mes),
      Boolean(body.purgar),
    );
    const { reporte, historial, avisos, ics, purgadas } = paquete;
    const zip = new JSZip();
    zip.file(
      "entregas.csv",
      csv([
        ["cliente", "encargo", "tipo", "estado", "entrega", "urgente", "pasos hechos", "notas"],
        ...reporte.tareas.map((tarea) => [
          tarea.nombre_cliente,
          tarea.titulo,
          tarea.tipo,
          tarea.estado,
          tarea.fecha_entrega ?? "",
          tarea.urgente ? "sí" : "no",
          `${tarea.pasos.filter((paso) => paso.hecho_en).length} de ${tarea.pasos.length}`,
          tarea.descripcion,
        ]),
      ]),
    );
    zip.file(
      "pasos.csv",
      csv([
        ["cliente", "encargo", "orden", "paso", "fecha", "hecho"],
        ...reporte.tareas.flatMap((tarea) =>
          tarea.pasos.map((paso) => [
            tarea.nombre_cliente,
            tarea.titulo,
            String(paso.orden),
            paso.nombre,
            paso.fecha ?? "",
            paso.hecho_en ?? "",
          ]),
        ),
      ]),
    );
    zip.file(
      "historial.csv",
      csv([
        ["tarea", "titulo", "antes", "despues", "nota", "cuando"],
        ...historial.map((item) => [
          String(item.tarea_id),
          item.titulo,
          item.estado_anterior ?? "",
          item.estado_nuevo,
          item.nota,
          item.creado_en instanceof Date ? item.creado_en.toISOString() : String(item.creado_en),
        ]),
      ]),
    );
    zip.file(
      "avisos.csv",
      csv([
        ["titulo", "canal", "estado", "detalle", "cuando"],
        ...avisos.map((aviso) => [
          aviso.titulo,
          aviso.canal,
          aviso.estado,
          aviso.detalle,
          aviso.creado_en instanceof Date ? aviso.creado_en.toISOString() : String(aviso.creado_en),
        ]),
      ]),
    );
    zip.file("calendario.ics", ics);
    zip.file("resumen.json", JSON.stringify(reporte.resumen, null, 2));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const nombre = `natvisual-${Number(body.anio)}-${String(Number(body.mes)).padStart(2, "0")}.zip`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "X-Natvisual-Purgadas": String(purgadas),
      },
    });
  } catch (error) {
    if (error instanceof EstudioError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "No se pudo armar el informe." }, { status: 500 });
  }
}
