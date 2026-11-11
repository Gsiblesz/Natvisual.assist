export const ESTADOS = [
  { id: "pendiente", label: "Pendiente", columna: "Por hacer" },
  { id: "en_progreso", label: "En curso", columna: "En curso" },
  { id: "hecho", label: "Terminada", columna: "Terminadas" },
] as const;

export const PRIORIDAD_CLIENTE = [
  { id: 1, label: "Alta" },
  { id: 2, label: "Media" },
  { id: 3, label: "Baja" },
];

export const URGENCIA = [
  { id: 1, label: "Urgente" },
  { id: 2, label: "Pronto" },
  { id: 3, label: "Puede esperar" },
];

export const ETIQUETAS = ["Estrategia", "Diseño", "Pauta", "Contenido", "Informe"];

export function etiquetaEstado(estado: string) {
  return ESTADOS.find((item) => item.id === estado)?.label || estado;
}

export function etiquetaPrioridad(tarea: {
  prioridad_cliente: number;
  urgencia_humana: number;
  prioridad_modo: string;
}) {
  const cliente =
    PRIORIDAD_CLIENTE.find((item) => item.id === Number(tarea.prioridad_cliente))?.label ||
    "Media";
  const equipo =
    URGENCIA.find((item) => item.id === Number(tarea.urgencia_humana))?.label || "Pronto";
  return tarea.prioridad_modo === "humana" ? `Equipo · ${equipo}` : `Cliente · ${cliente}`;
}

export const fieldClass =
  "h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus-visible:border-amber-400/70";
