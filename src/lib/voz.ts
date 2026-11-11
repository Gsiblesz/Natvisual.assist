import { fechaEnCaracas, sumarDias } from "./fechas";

export type AccionVoz =
  | { accion: "vacia"; aviso: string }
  | { accion: "no"; aviso: string }
  | {
      accion: "mover";
      id: number;
      estado: "en_progreso" | "hecho";
      titulo: string;
      aviso: string;
    }
  | {
      accion: "crear";
      titulo: string;
      estado: "pendiente";
      fecha_entrega: string | null;
      prioridad_cliente?: number;
      urgencia_humana?: number;
      prioridad_modo?: "cliente" | "humana";
      aviso: string;
    };

type TareaMin = { id: number; titulo: string };

export function normalizar(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizar(texto: string) {
  const limpio = String(texto || "")
    .trim()
    .replace(/\s+/g, " ");
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : "";
}

function buscarTarea(frase: string, tareas: TareaMin[]) {
  const busqueda = normalizar(frase);
  if (!busqueda) return null;
  const coincidencias = tareas
    .map((tarea) => ({ tarea, titulo: normalizar(tarea.titulo) }))
    .filter(
      (item) =>
        item.titulo &&
        (item.titulo.includes(busqueda) || busqueda.includes(item.titulo)),
    );
  if (!coincidencias.length) return null;
  coincidencias.sort((a, b) => a.titulo.length - b.titulo.length);
  return coincidencias[0].tarea;
}

function prioridades(texto: string) {
  const extra: {
    urgencia_humana?: number;
    prioridad_cliente?: number;
    prioridad_modo?: "cliente" | "humana";
  } = {};
  if (/\burgente\b|\bya\b/.test(texto)) {
    extra.urgencia_humana = 1;
    extra.prioridad_modo = "humana";
  }
  if (/prioridad alta|muy importante/.test(texto)) {
    extra.prioridad_cliente = 1;
    extra.prioridad_modo = extra.prioridad_modo || "cliente";
  }
  return extra;
}

export function interpretar(frase: string, tareas: TareaMin[] = []): AccionVoz {
  const texto = normalizar(frase);
  if (!texto) return { accion: "vacia", aviso: "No escuché nada." };

  const enCurso =
    texto.match(/^(?:pon |pasa |pasar |mueve |marca )?(?:a )?en curso\s+(.+)$/) ||
    texto.match(/^(.+?)\s+en curso$/);
  if (enCurso) {
    const tarea = buscarTarea(enCurso[1], tareas);
    return tarea
      ? {
          accion: "mover",
          id: tarea.id,
          estado: "en_progreso",
          titulo: tarea.titulo,
          aviso: `${tarea.titulo} pasó a en curso.`,
        }
      : { accion: "no", aviso: `No encontré “${capitalizar(enCurso[1])}”.` };
  }

  const terminada =
    texto.match(
      /^(?:pon |pasa |pasar |mueve |marca )?(?:como )?(?:terminad[ao]|hech[ao]|lista|completad[ao]|finalizad[ao]|cerrar|cierra|completar|terminar|finalizar)\s+(.+)$/,
    ) ||
    texto.match(/^(.+?)\s+(?:terminad[ao]|hech[ao]|lista|completad[ao]|finalizad[ao])$/);
  if (terminada) {
    const tarea = buscarTarea(terminada[1], tareas);
    return tarea
      ? {
          accion: "mover",
          id: tarea.id,
          estado: "hecho",
          titulo: tarea.titulo,
          aviso: `${tarea.titulo} quedó en actividades terminadas.`,
        }
      : { accion: "no", aviso: `No encontré “${capitalizar(terminada[1])}”.` };
  }

  const nueva = texto.match(
    /^(?:nueva actividad|nueva entrega|nueva|nuevo|agrega|agregar|anota|anotar|pendiente|crea|crear)\s+(.+)$/,
  );
  const titulo = capitalizar(nueva ? nueva[1] : texto);
  const hoy = fechaEnCaracas();
  return {
    accion: "crear",
    titulo,
    estado: "pendiente",
    fecha_entrega: /\bhoy\b/.test(texto) ? hoy : /\bmanana\b/.test(texto) ? sumarDias(hoy, 1) : null,
    ...prioridades(texto),
    aviso: `Quedó pendiente: ${titulo}.`,
  };
}
