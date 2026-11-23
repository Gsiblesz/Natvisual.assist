import { sql } from "./db";
import { rangoMes } from "./fechas";
import { calendarioIcs } from "./ics";
import { pasosConFecha, tipoDe } from "./plan";

export class EstudioError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type Estado = "pendiente" | "en_progreso" | "hecho";
export type EstadoCliente = "activo" | "inactivo" | "archivado";

export type Paso = {
  id: number;
  tarea_id: number;
  orden: number;
  nombre: string;
  fecha: string | null;
  hecho_en: string | null;
};

export type Tarea = {
  id: number;
  cuenta_id: number;
  nombre_cliente: string;
  estado_cliente: EstadoCliente;
  titulo: string;
  descripcion: string;
  tipo: string;
  estado: Estado;
  urgente: boolean;
  fecha_entrega: string | null;
  creado_en: string;
  pasos: Paso[];
};

export type Cuenta = {
  id: number;
  nombre_cliente: string;
  estado: EstadoCliente;
};

const ESTADOS_CLIENTE = new Set<EstadoCliente>(["activo", "inactivo", "archivado"]);

function texto(valor: unknown) {
  if (valor instanceof Date) return valor.toISOString();
  return valor == null ? "" : String(valor);
}

function fechaIso(valor: unknown) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function validarFecha(fecha: unknown) {
  if (fecha === null || fecha === undefined || fecha === "") return null;
  const valor = String(fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new EstudioError("La fecha no es válida.");
  return valor;
}

// ---------- Clientes ----------

export async function listarCuentas(): Promise<Cuenta[]> {
  const rows = await sql<Cuenta>(
    "select id, nombre_cliente, estado from cuentas order by lower(nombre_cliente), id",
  );
  return rows.map((cuenta) => ({ ...cuenta, id: Number(cuenta.id) }));
}

async function exigirCuenta(id: number) {
  const rows = await sql<{ id: number }>("select id from cuentas where id = $1", [id]);
  if (!rows[0]) throw new EstudioError("Ese cliente no existe.", 404);
}

export async function crearCuenta(nombre: string) {
  const limpio = nombre.trim();
  if (!limpio) throw new EstudioError("Escribe el nombre del cliente.");
  const rows = await sql<Cuenta>(
    "insert into cuentas (nombre_cliente) values ($1) returning id, nombre_cliente, estado",
    [limpio],
  );
  return { ...rows[0], id: Number(rows[0].id) };
}

export async function actualizarCuenta(id: number, input: { nombre_cliente?: string; estado?: string }) {
  await exigirCuenta(id);
  if (input.nombre_cliente !== undefined) {
    const nombre = String(input.nombre_cliente).trim();
    if (!nombre) throw new EstudioError("Escribe el nombre del cliente.");
    await sql("update cuentas set nombre_cliente = $2 where id = $1", [id, nombre]);
  }
  if (input.estado !== undefined) {
    if (!ESTADOS_CLIENTE.has(input.estado as EstadoCliente)) throw new EstudioError("Ese estado no existe.");
    await sql(
      "update cuentas set estado = $2, estado_desde = now() where id = $1 and estado <> $2",
      [id, input.estado],
    );
  }
  const rows = await sql<Cuenta>("select id, nombre_cliente, estado from cuentas where id = $1", [id]);
  return { ...rows[0], id: Number(rows[0].id) };
}

export async function borrarCuenta(id: number) {
  await exigirCuenta(id);
  // Borra en cascada encargos, pasos, historial y avisos de ese cliente.
  await sql("delete from cuentas where id = $1", [id]);
}

// ---------- Encargos ----------

type TareaRow = {
  id: number;
  cuenta_id: number;
  nombre_cliente: string;
  estado_cliente: EstadoCliente;
  titulo: string;
  descripcion: string;
  tipo: string;
  estado: Estado;
  urgencia_humana: number;
  fecha_entrega: string | Date | null;
  creado_en: string | Date;
};

const TAREA_SELECT = `
  select t.id, t.cuenta_id, c.nombre_cliente, c.estado as estado_cliente, t.titulo, t.descripcion,
    t.tipo, t.estado, t.urgencia_humana,
    to_char(t.fecha_entrega, 'YYYY-MM-DD') as fecha_entrega, t.creado_en
  from tareas t
  join cuentas c on c.id = t.cuenta_id
`;

type PasoRow = {
  id: number;
  tarea_id: number;
  orden: number;
  nombre: string;
  fecha: string | null;
  hecho_en: string | Date | null;
};

function mapPaso(row: PasoRow): Paso {
  return {
    id: Number(row.id),
    tarea_id: Number(row.tarea_id),
    orden: Number(row.orden),
    nombre: row.nombre,
    fecha: fechaIso(row.fecha),
    hecho_en: row.hecho_en ? texto(row.hecho_en) : null,
  };
}

async function pasosDe(ids: number[]) {
  if (!ids.length) return new Map<number, Paso[]>();
  const rows = await sql<PasoRow>(
    `select id, tarea_id, orden, nombre, to_char(fecha, 'YYYY-MM-DD') as fecha, hecho_en
     from pasos where tarea_id = any($1::int[]) order by tarea_id, orden, id`,
    [ids],
  );
  const mapa = new Map<number, Paso[]>();
  for (const row of rows) {
    const paso = mapPaso(row);
    const lista = mapa.get(paso.tarea_id) || [];
    lista.push(paso);
    mapa.set(paso.tarea_id, lista);
  }
  return mapa;
}

async function conPasos(rows: TareaRow[]): Promise<Tarea[]> {
  const mapa = await pasosDe(rows.map((row) => Number(row.id)));
  return rows.map((row) => ({
    id: Number(row.id),
    cuenta_id: Number(row.cuenta_id),
    nombre_cliente: row.nombre_cliente,
    estado_cliente: row.estado_cliente,
    titulo: row.titulo,
    descripcion: row.descripcion || "",
    tipo: row.tipo || "otro",
    estado: row.estado,
    urgente: Number(row.urgencia_humana) === 1,
    fecha_entrega: fechaIso(row.fecha_entrega),
    creado_en: texto(row.creado_en),
    pasos: mapa.get(Number(row.id)) || [],
  }));
}

export async function listarTareas(cuentaId: number | null = null) {
  const rows = await sql<TareaRow>(
    `${TAREA_SELECT}
     where ($1::int is null or t.cuenta_id = $1)
     order by t.fecha_entrega nulls last, t.id`,
    [cuentaId],
  );
  return conPasos(rows);
}

export async function obtenerTarea(id: number) {
  const rows = await sql<TareaRow>(`${TAREA_SELECT} where t.id = $1`, [id]);
  if (!rows[0]) throw new EstudioError("Ese encargo no existe.", 404);
  return (await conPasos(rows))[0];
}

async function historial(tareaId: number, antes: string | null, despues: string, nota: string) {
  await sql(
    "insert into historial (tarea_id, estado_anterior, estado_nuevo, nota) values ($1, $2, $3, $4)",
    [tareaId, antes, despues, nota],
  );
}

// El estado del encargo sale de sus pasos.
async function recalcular(tareaId: number, nota: string) {
  const [fila] = await sql<{ estado: Estado; total: number; hechos: number }>(
    `select t.estado,
       (select count(*) from pasos p where p.tarea_id = t.id)::int as total,
       (select count(*) from pasos p where p.tarea_id = t.id and p.hecho_en is not null)::int as hechos
     from tareas t where t.id = $1`,
    [tareaId],
  );
  if (!fila) return;
  const total = Number(fila.total);
  const hechos = Number(fila.hechos);
  const nuevo: Estado = total > 0 && hechos === total ? "hecho" : hechos > 0 ? "en_progreso" : "pendiente";
  await sql("update tareas set estado = $2, actualizado_en = now() where id = $1", [tareaId, nuevo]);
  await historial(tareaId, fila.estado, nuevo, nota);
}

export type EncargoInput = {
  cuenta_id?: number;
  titulo?: string;
  descripcion?: string;
  tipo?: string;
  fecha_entrega?: string | null;
  urgente?: boolean;
  pasos?: { nombre: string; fecha?: string | null }[];
};

export async function crearEncargo(input: EncargoInput) {
  const titulo = String(input.titulo ?? "").trim();
  if (!titulo) throw new EstudioError("Escribe qué hay que hacer.");
  const cuentaId = Number(input.cuenta_id);
  if (!Number.isInteger(cuentaId) || cuentaId <= 0) throw new EstudioError("Elige un cliente.");
  await exigirCuenta(cuentaId);
  const tipo = tipoDe(String(input.tipo ?? "otro")).id;
  const fecha = validarFecha(input.fecha_entrega);
  const pasos = (input.pasos?.length ? input.pasos : pasosConFecha(tipo, fecha))
    .map((paso) => ({ nombre: String(paso.nombre ?? "").trim(), fecha: validarFecha(paso.fecha) }))
    .filter((paso) => paso.nombre);
  if (!pasos.length) throw new EstudioError("El encargo necesita al menos un paso.");

  const [fila] = await sql<{ id: number }>(
    `insert into tareas (cuenta_id, titulo, descripcion, tipo, estado, urgencia_humana, prioridad_modo, fecha_entrega)
     values ($1, $2, $3, $4, 'pendiente', $5, 'humana', $6) returning id`,
    [cuentaId, titulo, String(input.descripcion ?? ""), tipo, input.urgente ? 1 : 2, fecha],
  );
  const id = Number(fila.id);
  for (const [indice, paso] of pasos.entries()) {
    await sql("insert into pasos (tarea_id, orden, nombre, fecha) values ($1, $2, $3, $4)", [
      id,
      indice + 1,
      paso.nombre,
      paso.fecha,
    ]);
  }
  await historial(id, null, "pendiente", `Creado con ${pasos.length} pasos`);
  return obtenerTarea(id);
}

export async function actualizarEncargo(id: number, input: EncargoInput) {
  const previa = await obtenerTarea(id);
  const titulo = input.titulo === undefined ? previa.titulo : String(input.titulo).trim();
  if (!titulo) throw new EstudioError("Escribe qué hay que hacer.");
  let cuentaId = previa.cuenta_id;
  if (input.cuenta_id !== undefined) {
    cuentaId = Number(input.cuenta_id);
    await exigirCuenta(cuentaId);
  }
  const fecha = input.fecha_entrega === undefined ? previa.fecha_entrega : validarFecha(input.fecha_entrega);
  await sql(
    `update tareas set cuenta_id = $2, titulo = $3, descripcion = $4, tipo = $5, urgencia_humana = $6,
       fecha_entrega = $7, actualizado_en = now()
     where id = $1`,
    [
      id,
      cuentaId,
      titulo,
      input.descripcion === undefined ? previa.descripcion : String(input.descripcion),
      input.tipo === undefined ? previa.tipo : tipoDe(String(input.tipo)).id,
      (input.urgente === undefined ? previa.urgente : input.urgente) ? 1 : 2,
      fecha,
    ],
  );
  return obtenerTarea(id);
}

export async function borrarEncargo(id: number) {
  await obtenerTarea(id);
  await sql("delete from tareas where id = $1", [id]);
}

// ---------- Pasos ----------

async function obtenerPaso(id: number) {
  const rows = await sql<PasoRow>(
    `select id, tarea_id, orden, nombre, to_char(fecha, 'YYYY-MM-DD') as fecha, hecho_en
     from pasos where id = $1`,
    [id],
  );
  if (!rows[0]) throw new EstudioError("Ese paso no existe.", 404);
  return mapPaso(rows[0]);
}

export async function agregarPaso(tareaId: number, input: { nombre?: string; fecha?: string | null }) {
  await obtenerTarea(tareaId);
  const nombre = String(input.nombre ?? "").trim();
  if (!nombre) throw new EstudioError("Escribe el nombre del paso.");
  const [fila] = await sql<{ siguiente: number }>(
    "select coalesce(max(orden), 0) + 1 as siguiente from pasos where tarea_id = $1",
    [tareaId],
  );
  await sql("insert into pasos (tarea_id, orden, nombre, fecha) values ($1, $2, $3, $4)", [
    tareaId,
    Number(fila.siguiente),
    nombre,
    validarFecha(input.fecha),
  ]);
  await recalcular(tareaId, `Paso agregado: ${nombre}`);
  return obtenerTarea(tareaId);
}

export async function actualizarPaso(
  id: number,
  input: { nombre?: string; fecha?: string | null; hecho?: boolean },
) {
  const paso = await obtenerPaso(id);
  if (input.nombre !== undefined) {
    const nombre = String(input.nombre).trim();
    if (!nombre) throw new EstudioError("Escribe el nombre del paso.");
    await sql("update pasos set nombre = $2 where id = $1", [id, nombre]);
  }
  if (input.fecha !== undefined) {
    await sql("update pasos set fecha = $2 where id = $1", [id, validarFecha(input.fecha)]);
  }
  if (input.hecho !== undefined && Boolean(paso.hecho_en) !== input.hecho) {
    await sql(`update pasos set hecho_en = ${input.hecho ? "now()" : "null"} where id = $1`, [id]);
    await recalcular(paso.tarea_id, `${input.hecho ? "Paso hecho" : "Paso reabierto"}: ${paso.nombre}`);
  }
  return obtenerTarea(paso.tarea_id);
}

export async function borrarPaso(id: number) {
  const paso = await obtenerPaso(id);
  const [fila] = await sql<{ total: number }>("select count(*)::int as total from pasos where tarea_id = $1", [
    paso.tarea_id,
  ]);
  if (Number(fila.total) <= 1) throw new EstudioError("El encargo necesita al menos un paso.");
  await sql("delete from pasos where id = $1", [id]);
  await recalcular(paso.tarea_id, `Paso quitado: ${paso.nombre}`);
  return obtenerTarea(paso.tarea_id);
}

export async function historialDe(id: number) {
  await obtenerTarea(id);
  const rows = await sql<{
    id: number;
    estado_anterior: string | null;
    estado_nuevo: string;
    nota: string;
    creado_en: string | Date;
  }>(
    `select id, estado_anterior, estado_nuevo, nota, creado_en
     from historial where tarea_id = $1 order by creado_en desc, id desc`,
    [id],
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), creado_en: texto(row.creado_en) }));
}

// ---------- Avisos ----------

export async function registrarAviso(input: {
  cuenta_id: number | null;
  titulo: string;
  canal: string;
  estado: string;
  detalle: string;
}) {
  if (input.cuenta_id == null) return;
  await sql(
    `insert into avisos (cuenta_id, titulo, canal, estado, detalle) values ($1, $2, $3, $4, $5)`,
    [input.cuenta_id, input.titulo, input.canal, input.estado, input.detalle],
  );
}

// ---------- Cierre del mes ----------

export async function informeMes(cuentaId: number | null, anio: number, mes: number) {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new EstudioError("Elige un mes válido.");
  }
  const { inicio, fin } = rangoMes(anio, mes);
  const rows = await sql<TareaRow>(
    `${TAREA_SELECT}
     where ($1::int is null or t.cuenta_id = $1)
       and (
         (t.fecha_entrega >= $2::date and t.fecha_entrega < $3::date)
         or (t.fecha_entrega is null and t.creado_en >= $2::date and t.creado_en < $3::date)
       )
     order by t.fecha_entrega nulls last, t.id`,
    [cuentaId, inicio, fin],
  );
  const tareas = await conPasos(rows);
  return {
    resumen: {
      total: tareas.length,
      pendiente: tareas.filter((t) => t.estado === "pendiente").length,
      en_progreso: tareas.filter((t) => t.estado === "en_progreso").length,
      hecho: tareas.filter((t) => t.estado === "hecho").length,
    },
    tareas,
    inicio,
    fin,
  };
}

export function csv(filas: string[][]) {
  return filas
    .map((fila) =>
      fila
        .map((celda) => {
          const valor = /^[=+\-@]/.test(celda) ? `'${celda}` : celda;
          return `"${valor.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
}

export async function armarInforme(cuentaId: number | null, anio: number, mes: number, purgar: boolean) {
  if (purgar && cuentaId == null) {
    throw new EstudioError("Elige un cliente antes de borrar encargos terminados.");
  }
  const reporte = await informeMes(cuentaId, anio, mes);
  const ids = reporte.tareas.map((t) => t.id);
  const historialFilas = ids.length
    ? await sql<{
        tarea_id: number;
        titulo: string;
        estado_anterior: string | null;
        estado_nuevo: string;
        nota: string;
        creado_en: string | Date;
      }>(
        `select h.tarea_id, t.titulo, h.estado_anterior, h.estado_nuevo, h.nota, h.creado_en
         from historial h join tareas t on t.id = h.tarea_id
         where h.tarea_id = any($1::int[])
         order by h.creado_en, h.id`,
        [ids],
      )
    : [];
  const avisos = await sql<{
    titulo: string;
    canal: string;
    estado: string;
    detalle: string;
    creado_en: string | Date;
  }>(
    `select titulo, canal, estado, detalle, creado_en from avisos
     where ($1::int is null or cuenta_id = $1)
       and creado_en >= $2::date and creado_en < $3::date
     order by creado_en`,
    [cuentaId, reporte.inicio, reporte.fin],
  );
  const ics = calendarioIcs(
    reporte.tareas
      .filter((t) => t.fecha_entrega)
      .map((t) => ({
        id: t.id,
        titulo: t.titulo,
        descripcion: t.descripcion,
        fecha_entrega: t.fecha_entrega as string,
        nombre_cliente: t.nombre_cliente,
      })),
    "NatVisual",
  );
  let purgadas = 0;
  if (purgar && cuentaId != null) {
    const borradas = await sql<{ id: number }>(
      `delete from tareas
       where cuenta_id = $1 and estado = 'hecho'
         and fecha_entrega >= $2::date and fecha_entrega < $3::date
       returning id`,
      [cuentaId, reporte.inicio, reporte.fin],
    );
    purgadas = borradas.length;
  }
  return { reporte, historial: historialFilas, avisos, ics, purgadas };
}
