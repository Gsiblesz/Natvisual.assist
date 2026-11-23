import webpush from "web-push";
import { sql } from "./db";
import { listarTareas } from "./estudio";
import { fechaEnCaracas } from "./fechas";
import { grupoDe, siguientePaso } from "./plan";

type Vapid = { publicKey: string; privateKey: string };

// Las claves de notificación se crean solas la primera vez y quedan en la base.
// Así nadie tiene que pegarlas en Vercel.
async function claves(): Promise<Vapid> {
  const [fila] = await sql<{ valor: string }>("select valor from ajustes where clave = 'vapid'");
  if (fila) return JSON.parse(fila.valor) as Vapid;
  const nuevas = webpush.generateVAPIDKeys();
  await sql("insert into ajustes (clave, valor) values ('vapid', $1) on conflict (clave) do nothing", [
    JSON.stringify(nuevas),
  ]);
  const [guardada] = await sql<{ valor: string }>("select valor from ajustes where clave = 'vapid'");
  return JSON.parse(guardada.valor) as Vapid;
}

export async function clavePublica() {
  return (await claves()).publicKey;
}

function sujeto() {
  const dominio = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || "natvisualassist.vercel.app";
  return `https://${dominio.replace(/^https?:\/\//, "")}`;
}

export type Suscripcion = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function guardarSuscripcion(input: Suscripcion) {
  if (!input?.endpoint?.startsWith("https://") || !input.keys?.p256dh || !input.keys?.auth) {
    throw new Error("La suscripción no es válida.");
  }
  await sql(
    `insert into suscripciones (endpoint, p256dh, auth) values ($1, $2, $3)
     on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`,
    [input.endpoint, input.keys.p256dh, input.keys.auth],
  );
}

export async function quitarSuscripcion(endpoint: string) {
  await sql("delete from suscripciones where endpoint = $1", [endpoint]);
}

export async function haySuscripcion(endpoint: string) {
  const rows = await sql("select 1 from suscripciones where endpoint = $1", [endpoint]);
  return rows.length > 0;
}

export async function enviarATodos(aviso: { title: string; body: string; url?: string }) {
  const vapid = await claves();
  const subs = await sql<{ endpoint: string; p256dh: string; auth: string }>(
    "select endpoint, p256dh, auth from suscripciones",
  );
  let enviadas = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ ...aviso, url: aviso.url || "/natvisual" }),
        { vapidDetails: { subject: sujeto(), ...vapid }, TTL: 60 * 60 * 12 },
      );
      enviadas += 1;
    } catch (error) {
      const codigo = (error as { statusCode?: number }).statusCode;
      // El teléfono ya no acepta avisos: se borra la suscripción vieja.
      if (codigo === 404 || codigo === 410) await quitarSuscripcion(sub.endpoint);
      else console.error("push", codigo);
    }
  }
  return { enviadas, total: subs.length };
}

// Lo que toca hoy: el siguiente paso de cada encargo abierto de clientes activos.
export async function resumenDeHoy() {
  const hoy = fechaEnCaracas();
  const tareas = (await listarTareas()).filter(
    (tarea) => tarea.estado !== "hecho" && tarea.estado_cliente === "activo",
  );
  const items = tareas
    .map((tarea) => {
      const paso = siguientePaso(tarea.pasos);
      if (!paso) return null;
      const fecha = paso.fecha || tarea.fecha_entrega;
      return { tarea, paso, grupo: grupoDe(fecha, hoy) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const atrasados = items.filter((item) => item.grupo === "atrasado");
  const deHoy = items.filter((item) => item.grupo === "hoy");
  const lista = [...atrasados, ...deHoy];
  if (!lista.length) {
    return { title: "Buenos días", body: "Hoy no tienes pasos pendientes. Toca para ver lo que viene." };
  }
  const partes = [];
  if (deHoy.length) partes.push(`${deHoy.length} para hoy`);
  if (atrasados.length) partes.push(`${atrasados.length} atrasado${atrasados.length === 1 ? "" : "s"}`);
  const detalle = lista
    .slice(0, 3)
    .map((item) => `${item.paso.nombre}: ${item.tarea.titulo} (${item.tarea.nombre_cliente})`)
    .join("\n");
  const mas = lista.length > 3 ? `\ny ${lista.length - 3} más` : "";
  return { title: `Hoy: ${partes.join(" · ")}`, body: `${detalle}${mas}` };
}
