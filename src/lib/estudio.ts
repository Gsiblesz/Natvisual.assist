import { randomBytes } from "node:crypto";
import { sql } from "./db";
import { fechaEnCaracas, rangoMes, sumarDias } from "./fechas";
import { calendarioIcs } from "./ics";

export class EstudioError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type Estado = "pendiente" | "en_progreso" | "hecho";
export type Modo = "cliente" | "humana";

export type Tarea = {
  id: number;
  cuenta_id: number;
  nombre_cliente: string;
  titulo: string;
  descripcion: string;
  estado: Estado;
  prioridad_cliente: number;
  urgencia_humana: number;
  prioridad_modo: Modo;
  fecha_entrega: string | null;
  etiqueta: string;
  google_event_id: string | null;
  creado_en: string;
};

type TareaRow = Omit<Tarea, "fecha_entrega" | "creado_en" | "google_event_id"> & {
  fecha_entrega: string | null;
  google_event_id: string | null;
  creado_en: string | Date;
};

const ESTADOS = new Set<Estado>(["pendiente", "en_progreso", "hecho"]);

function texto(valor: unknown) {
  if (valor instanceof Date) return valor.toISOString();
  return valor == null ? "" : String(valor);
}

function mapTarea(row: TareaRow): Tarea {
  return {
    ...row,
    id: Number(row.id),
    cuenta_id: Number(row.cuenta_id),
    prioridad_cliente: Number(row.prioridad_cliente),
    urgencia_humana: Number(row.urgencia_humana),
    fecha_entrega: row.fecha_entrega ? String(row.fecha_entrega).slice(0, 10) : null,
    google_event_id: row.google_event_id,
    creado_en: texto(row.creado_en),
    descripcion: row.descripcion || "",
    etiqueta: row.etiqueta || "",
  };
}

const TAREA_SELECT = `
  select t.id, t.cuenta_id, c.nombre_cliente, t.titulo, t.descripcion, t.estado,
    t.prioridad_cliente, t.urgencia_humana, t.prioridad_modo,
    to_char(t.fecha_entrega, 'YYYY-MM-DD') as fecha_entrega,
    t.etiqueta, t.google_event_id, t.creado_en
  from tareas t
  join cuentas c on c.id = t.cuenta_id
`;

export async function listarCuentas() {
  const cuentas = await sql<{ id: number; nombre_cliente: string }>(
    "select id, nombre_cliente from cuentas order by nombre_cliente, id",
  );
  return cuentas.map((cuenta) => ({ ...cuenta, id: Number(cuenta.id) }));
}

export async function crearCuenta(nombre: string) {
  const limpio = nombre.trim();
  if (!limpio) throw new EstudioError("Escribe el nombre del cliente.");
  const rows = await sql<{ id: number; nombre_cliente: string }>(
    "insert into cuentas (nombre_cliente) values ($1) returning id, nombre_cliente",
    [limpio],
  );
  const cuenta = rows[0];
  await ensureCalendario(Number(cuenta.id));
  return { ...cuenta, id: Number(cuenta.id) };
}

export async function listarTareas(cuentaId: number | null) {
  const rows = await sql<TareaRow>(
    `${TAREA_SELECT}
     where ($1::int is null or t.cuenta_id = $1)
     order by t.fecha_entrega nulls last, t.urgencia_humana, t.prioridad_cliente, t.id`,
    [cuentaId],
  );
  return rows.map(mapTarea);
}

export type TareaInput = {
  cuenta_id: number;
  titulo: string;
  descripcion?: string;
  estado?: Estado;
  prioridad_cliente?: number;
  urgencia_humana?: number;
  prioridad_modo?: Modo;
  fecha_entrega?: string | null;
  etiqueta?: string;
  origen?: string;
};

function prioridad(valor: unknown, fallback: number) {
  const numero = Number(valor ?? fallback);
  if (![1, 2, 3].includes(numero)) throw new EstudioError("La prioridad tiene que ser alta, media o baja.");
  return numero;
}

function leerTarea(input: TareaInput, previa?: Tarea) {
  const titulo = String(input.titulo ?? previa?.titulo ?? "").trim();
  if (!titulo) throw new EstudioError("Escribe qué hay que entregar.");
  const cuentaId = Number(input.cuenta_id ?? previa?.cuenta_id);
  if (!Number.isInteger(cuentaId) || cuentaId <= 0) {
    throw new EstudioError("Elige un cliente.");
  }
  const estado = (input.estado ?? previa?.estado ?? "pendiente") as Estado;
  if (!ESTADOS.has(estado)) throw new EstudioError("Ese estado no existe.");
  const modo = (input.prioridad_modo ?? previa?.prioridad_modo ?? "cliente") as Modo;
  if (modo !== "cliente" && modo !== "humana") throw new EstudioError("Elige si manda la marca o el equipo.");
  const fecha = input.fecha_entrega === undefined ? previa?.fecha_entrega ?? null : input.fecha_entrega;
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new EstudioError("La fecha de entrega no es válida.");
  }
  return {
    cuenta_id: cuentaId,
    titulo,
    descripcion: String(input.descripcion ?? previa?.descripcion ?? ""),
    estado,
    prioridad_cliente: prioridad(input.prioridad_cliente, previa?.prioridad_cliente ?? 2),
    urgencia_humana: prioridad(input.urgencia_humana, previa?.urgencia_humana ?? 2),
    prioridad_modo: modo,
    fecha_entrega: fecha || null,
    etiqueta: String(input.etiqueta ?? previa?.etiqueta ?? "").trim(),
  };
}

async function exigirCuenta(id: number) {
  const rows = await sql<{ id: number }>("select id from cuentas where id = $1", [id]);
  if (!rows[0]) throw new EstudioError("Ese cliente no existe.", 404);
}

export async function crearTarea(input: TareaInput) {
  const datos = leerTarea(input);
  await exigirCuenta(datos.cuenta_id);
  const rows = await sql<{ id: number }>(
    `insert into tareas (
      cuenta_id, titulo, descripcion, estado, prioridad_cliente, urgencia_humana,
      prioridad_modo, fecha_entrega, etiqueta
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [
      datos.cuenta_id,
      datos.titulo,
      datos.descripcion,
      datos.estado,
      datos.prioridad_cliente,
      datos.urgencia_humana,
      datos.prioridad_modo,
      datos.fecha_entrega,
      datos.etiqueta,
    ],
  );
  const id = Number(rows[0].id);
  await sql(
    `insert into historial (tarea_id, estado_anterior, estado_nuevo, nota)
     values ($1, null, $2, $3)`,
    [id, datos.estado, input.origen === "voz" ? "Creada por voz" : "Creada"],
  );
  return obtenerTarea(id);
}

export async function obtenerTarea(id: number) {
  const rows = await sql<TareaRow>(`${TAREA_SELECT} where t.id = $1`, [id]);
  if (!rows[0]) throw new EstudioError("Esa entrega no existe.", 404);
  return mapTarea(rows[0]);
}

export async function actualizarTarea(id: number, input: Partial<TareaInput>) {
  const previa = await obtenerTarea(id);
  const datos = leerTarea({ ...previa, ...input, cuenta_id: input.cuenta_id ?? previa.cuenta_id }, previa);
  if (datos.cuenta_id !== previa.cuenta_id) await exigirCuenta(datos.cuenta_id);
  await sql(
    `update tareas set
      cuenta_id = $2, titulo = $3, descripcion = $4, estado = $5,
      prioridad_cliente = $6, urgencia_humana = $7, prioridad_modo = $8,
      fecha_entrega = $9, etiqueta = $10, actualizado_en = now()
     where id = $1`,
    [
      id,
      datos.cuenta_id,
      datos.titulo,
      datos.descripcion,
      datos.estado,
      datos.prioridad_cliente,
      datos.urgencia_humana,
      datos.prioridad_modo,
      datos.fecha_entrega,
      datos.etiqueta,
    ],
  );
  const nota =
    previa.estado === datos.estado ? "Datos actualizados" : "Cambio de estado";
  await sql(
    `insert into historial (tarea_id, estado_anterior, estado_nuevo, nota)
     values ($1, $2, $3, $4)`,
    [id, previa.estado, datos.estado, nota],
  );
  return obtenerTarea(id);
}

export async function borrarTarea(id: number) {
  await obtenerTarea(id);
  await sql("delete from tareas where id = $1", [id]);
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
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    creado_en: texto(row.creado_en),
  }));
}

export async function cargarEjemplo(cuentaId: number) {
  await exigirCuenta(cuentaId);
  await sql(
    "delete from tareas where cuenta_id = $1 and descripcion like '[ejemplo]%'",
    [cuentaId],
  );
  const hoy = fechaEnCaracas();
  const piezas: Array<Omit<TareaInput, "cuenta_id">> = [
    {
      titulo: "Piezas del feed",
      descripcion: "[ejemplo] Seis piezas para la semana: hotel, restaurante y un reel de ambiente.",
      estado: "pendiente",
      etiqueta: "Contenido",
      fecha_entrega: sumarDias(hoy, 1),
      prioridad_cliente: 1,
      urgencia_humana: 2,
      prioridad_modo: "cliente",
    },
    {
      titulo: "Reel de habitaciones",
      descripcion: "[ejemplo] 20 segundos. Los primeros 3 tienen que mostrar la vista y la cama.",
      estado: "en_progreso",
      etiqueta: "Diseño",
      fecha_entrega: hoy,
      prioridad_cliente: 2,
      urgencia_humana: 1,
      prioridad_modo: "humana",
    },
    {
      titulo: "Pauta de reservas directas",
      descripcion: "[ejemplo] Campaña de Meta para bajar la dependencia de intermediarios.",
      estado: "pendiente",
      etiqueta: "Pauta",
      fecha_entrega: sumarDias(hoy, 3),
      prioridad_cliente: 1,
      urgencia_humana: 2,
      prioridad_modo: "cliente",
    },
    {
      titulo: "Guion del spot",
      descripcion: "[ejemplo] Una idea concreta para el local, sin menú de paquetes.",
      estado: "pendiente",
      etiqueta: "Estrategia",
      fecha_entrega: sumarDias(hoy, 5),
      prioridad_cliente: 2,
      urgencia_humana: 2,
      prioridad_modo: "cliente",
    },
    {
      titulo: "Informe de métricas",
      descripcion: "[ejemplo] Reservas, gasto y qué pieza sí llenó mesas.",
      estado: "hecho",
      etiqueta: "Informe",
      fecha_entrega: sumarDias(hoy, -2),
      prioridad_cliente: 3,
      urgencia_humana: 3,
      prioridad_modo: "cliente",
    },
    {
      titulo: "Cobertura del evento",
      descripcion: "[ejemplo] Foto y video corto de la noche. Entrega al día siguiente.",
      estado: "en_progreso",
      etiqueta: "Contenido",
      fecha_entrega: sumarDias(hoy, 2),
      prioridad_cliente: 2,
      urgencia_humana: 1,
      prioridad_modo: "humana",
    },
  ];
  for (const pieza of piezas) {
    await crearTarea({ ...pieza, cuenta_id: cuentaId, origen: "ejemplo" });
  }
  return listarTareas(cuentaId);
}

export type Calendario = {
  cuenta_id: number;
  proveedor: "ics" | "google";
  correo_equipo: string;
  google_calendar_id: string;
  aviso_horas: number;
  feed_token: string;
};

export async function ensureCalendario(cuentaId: number): Promise<Calendario> {
  await exigirCuenta(cuentaId);
  const actuales = await sql<Calendario>(
    `select cuenta_id, proveedor, correo_equipo, google_calendar_id, aviso_horas, feed_token
     from calendarios where cuenta_id = $1`,
    [cuentaId],
  );
  if (actuales[0]) {
    return { ...actuales[0], cuenta_id: Number(actuales[0].cuenta_id), aviso_horas: Number(actuales[0].aviso_horas) };
  }
  const token = randomBytes(24).toString("hex");
  await sql(
    `insert into calendarios (cuenta_id, feed_token) values ($1, $2)`,
    [cuentaId, token],
  );
  return {
    cuenta_id: cuentaId,
    proveedor: "ics",
    correo_equipo: "",
    google_calendar_id: "",
    aviso_horas: 24,
    feed_token: token,
  };
}

export function feedUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/api/feed/${token}`;
}

export async function guardarCalendario(
  cuentaId: number,
  input: {
    proveedor?: string;
    correo_equipo?: string;
    google_calendar_id?: string;
    aviso_horas?: number;
  },
) {
  await ensureCalendario(cuentaId);
  const proveedor = input.proveedor === "google" ? "google" : "ics";
  const horas = Number(input.aviso_horas ?? 24);
  if (!Number.isInteger(horas) || horas < 1 || horas > 168) {
    throw new EstudioError("Las horas de aviso van de 1 a 168.");
  }
  await sql(
    `update calendarios set proveedor = $2, correo_equipo = $3, google_calendar_id = $4, aviso_horas = $5
     where cuenta_id = $1`,
    [
      cuentaId,
      proveedor,
      String(input.correo_equipo ?? "").trim(),
      String(input.google_calendar_id ?? "").trim(),
      horas,
    ],
  );
  return ensureCalendario(cuentaId);
}

export async function rotarFeed(cuentaId: number) {
  await ensureCalendario(cuentaId);
  const token = randomBytes(24).toString("hex");
  await sql("update calendarios set feed_token = $2 where cuenta_id = $1", [cuentaId, token]);
  return ensureCalendario(cuentaId);
}

export async function calendarioPorToken(token: string) {
  const rows = await sql<{ cuenta_id: number; nombre_cliente: string }>(
    `select k.cuenta_id, c.nombre_cliente
     from calendarios k join cuentas c on c.id = k.cuenta_id
     where k.feed_token = $1`,
    [token],
  );
  return rows[0] ? { ...rows[0], cuenta_id: Number(rows[0].cuenta_id) } : null;
}

export async function listarAvisos(cuentaId: number | null) {
  const rows = await sql<{
    id: number;
    titulo: string;
    canal: string;
    estado: string;
    detalle: string;
    creado_en: string | Date;
  }>(
    `select id, titulo, canal, estado, detalle, creado_en
     from avisos
     where ($1::int is null or cuenta_id = $1)
     order by creado_en desc, id desc
     limit 30`,
    [cuentaId],
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), creado_en: texto(row.creado_en) }));
}

export async function registrarAviso(input: {
  cuenta_id: number;
  tarea_id?: number | null;
  titulo: string;
  canal: string;
  estado: string;
  detalle: string;
}) {
  await sql(
    `insert into avisos (cuenta_id, tarea_id, titulo, canal, estado, detalle)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      input.cuenta_id,
      input.tarea_id ?? null,
      input.titulo,
      input.canal,
      input.estado,
      input.detalle,
    ],
  );
}

export async function tareasPorVencer(cuentaId: number, horas: number) {
  const hoy = fechaEnCaracas();
  const fin = sumarDias(hoy, Math.max(0, Math.ceil(horas / 24)));
  const tareas = await listarTareas(cuentaId);
  return tareas.filter(
    (tarea) =>
      tarea.estado !== "hecho" &&
      tarea.fecha_entrega &&
      tarea.fecha_entrega >= hoy &&
      tarea.fecha_entrega <= fin,
  );
}

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
  const tareas = rows.map(mapTarea);
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

function csv(filas: string[][]) {
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
    throw new EstudioError("Elige un cliente antes de borrar entregas hechas.");
  }
  const reporte = await informeMes(cuentaId, anio, mes);
  const ids = reporte.tareas.map((t) => t.id);
  const historial = ids.length
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
  return { reporte, historial, avisos, ics, purgadas, csv };
}

export async function marcarEventoGoogle(tareaId: number, eventId: string) {
  await sql("update tareas set google_event_id = $2 where id = $1", [tareaId, eventId]);
}

export function conexionServidor() {
  return {
    google: Boolean(process.env.GOOGLE_ACCESS_TOKEN?.trim()),
    correo: Boolean(process.env.RESEND_API_KEY?.trim()),
  };
}
