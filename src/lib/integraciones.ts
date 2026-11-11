import {
  ensureCalendario,
  listarTareas,
  marcarEventoGoogle,
  obtenerTarea,
  registrarAviso,
  tareasPorVencer,
  type Calendario,
  type Tarea,
} from "./estudio";
import { sumarDias } from "./fechas";

async function googleFetch(path: string, init: RequestInit) {
  const token = process.env.GOOGLE_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("Falta el token de Google en el servidor.");
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message || "Google Calendar no aceptó el evento.");
  }
  return body;
}

function eventoGoogle(tarea: Tarea, horas: number) {
  return {
    summary: `${tarea.nombre_cliente}: ${tarea.titulo}`,
    description: tarea.descripcion || tarea.titulo,
    start: { date: tarea.fecha_entrega },
    end: { date: sumarDias(tarea.fecha_entrega as string, 1) },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: Math.min(horas, 168) * 60 }],
    },
  };
}

export async function sincronizarTarea(tarea: Tarea) {
  if (!tarea.fecha_entrega) return null;
  const calendario = await ensureCalendario(tarea.cuenta_id);
  if (calendario.proveedor !== "google") return { ok: true as const };
  if (!process.env.GOOGLE_ACCESS_TOKEN?.trim()) {
    return { ok: false as const, motivo: "Falta el token de Google en el servidor." };
  }
  if (!calendario.google_calendar_id) {
    return { ok: false as const, motivo: "Falta el ID del calendario de Google de este cliente." };
  }
  try {
    await publicarUna(calendario, tarea);
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      motivo: error instanceof Error ? error.message : "No se pudo publicar en Google.",
    };
  }
}

async function publicarUna(calendario: Calendario, tarea: Tarea) {
  const calendarId = encodeURIComponent(calendario.google_calendar_id);
  const payload = eventoGoogle(tarea, calendario.aviso_horas);
  if (tarea.google_event_id) {
    const body = await googleFetch(
      `/calendars/${calendarId}/events/${encodeURIComponent(tarea.google_event_id)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    );
    if (body.id) await marcarEventoGoogle(tarea.id, body.id);
    return;
  }
  const body = await googleFetch(`/calendars/${calendarId}/events`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (body.id) await marcarEventoGoogle(tarea.id, body.id);
}

export async function publicarEnGoogle(cuentaId: number) {
  const calendario = await ensureCalendario(cuentaId);
  if (!process.env.GOOGLE_ACCESS_TOKEN?.trim()) {
    return { motivo: "Falta el token de Google en el servidor." };
  }
  if (!calendario.google_calendar_id) {
    return { motivo: "Guarda el ID del calendario de Google de este cliente." };
  }
  const tareas = (await listarTareas(cuentaId)).filter(
    (tarea) => tarea.estado !== "hecho" && tarea.fecha_entrega,
  );
  if (!tareas.length) return { motivo: "No hay entregas abiertas con fecha para publicar." };
  let publicadas = 0;
  for (const tarea of tareas) {
    await publicarUna(calendario, await obtenerTarea(tarea.id));
    publicadas += 1;
  }
  await registrarAviso({
    cuenta_id: cuentaId,
    titulo: "Calendario publicado en Google",
    canal: "google",
    estado: "enviado",
    detalle: `${publicadas} entregas.`,
  });
  return { motivo: `Publiqué ${publicadas} entregas en Google Calendar.` };
}

function correos(lista: string) {
  return lista
    .split(/[,;\s]+/)
    .map((correo) => correo.trim())
    .filter((correo) => correo.includes("@"));
}

export async function avisarEquipo(cuentaId: number) {
  const calendario = await ensureCalendario(cuentaId);
  const proximas = await tareasPorVencer(cuentaId, calendario.aviso_horas);
  if (!proximas.length) {
    return { motivo: "No hay entregas abiertas en la ventana de aviso." };
  }
  const destinatarios = correos(calendario.correo_equipo);
  const resumen = proximas.map((tarea) => `${tarea.fecha_entrega} · ${tarea.titulo}`).join("\n");
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || destinatarios.length === 0) {
    await registrarAviso({
      cuenta_id: cuentaId,
      titulo: "Entregas próximas sin correo",
      canal: "correo",
      estado: "sin_envio",
      detalle: !apiKey
        ? "Falta Resend en el servidor."
        : "Faltan correos del equipo.",
    });
    return {
      motivo: !apiKey
        ? "Anoté el aviso, pero falta la clave de Resend para mandar el correo."
        : "Anoté el aviso, pero este cliente no tiene correos del equipo.",
    };
  }
  const from = process.env.RESEND_FROM?.trim() || "NatVisual <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: destinatarios,
      subject: `NatVisual: ${proximas.length} entregas por vencer`,
      text: `Entregas abiertas dentro de ${calendario.aviso_horas} h:\n\n${resumen}`,
    }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    await registrarAviso({
      cuenta_id: cuentaId,
      titulo: "No se pudo avisar al equipo",
      canal: "correo",
      estado: "error",
      detalle: error.message || "Resend rechazó el correo.",
    });
    return { motivo: error.message || "Resend rechazó el correo." };
  }
  await registrarAviso({
    cuenta_id: cuentaId,
    titulo: "Aviso de entregas próximas",
    canal: "correo",
    estado: "enviado",
    detalle: destinatarios.join(", "),
  });
  return { motivo: `Avisé a ${destinatarios.join(", ")}.` };
}
