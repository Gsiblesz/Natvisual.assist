import { sumarDias } from "./fechas";

export type EventoIcs = {
  id: number;
  titulo: string;
  descripcion: string;
  fecha_entrega: string;
  nombre_cliente: string;
};

function escapar(valor: string) {
  return valor
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function calendarioIcs(eventos: EventoIcs[], nombre = "NatVisual") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NatVisual//Estudio//ES",
    `X-WR-CALNAME:${escapar(nombre)}`,
    "CALSCALE:GREGORIAN",
  ];
  for (const evento of eventos) {
    if (!evento.fecha_entrega) continue;
    const inicio = evento.fecha_entrega.replace(/-/g, "");
    const fin = sumarDias(evento.fecha_entrega, 1).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:tarea-${evento.id}@natvisual`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART;VALUE=DATE:${inicio}`,
      `DTEND;VALUE=DATE:${fin}`,
      `SUMMARY:${escapar(`${evento.nombre_cliente}: ${evento.titulo}`)}`,
      `DESCRIPTION:${escapar(evento.descripcion || evento.titulo)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
