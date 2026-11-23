import { fechaEnCaracas, sumarDias } from "./fechas";

// Cada tipo de encargo trae sus pasos. El número es cuántos días antes (negativo)
// o después de la fecha de entrega cae ese paso.
export type PasoPlantilla = { nombre: string; dia: number };

export type Tipo = {
  id: string;
  label: string;
  palabras: string[];
  pasos: PasoPlantilla[];
};

export const TIPOS: Tipo[] = [
  {
    id: "reel",
    label: "Reel",
    palabras: ["reel", "reels", "tiktok", "tik tok", "short", "shorts", "video corto"],
    pasos: [
      { nombre: "Guion", dia: -4 },
      { nombre: "Grabación", dia: -3 },
      { nombre: "Edición", dia: -2 },
      { nombre: "Aprobación del cliente", dia: -1 },
      { nombre: "Publicar", dia: 0 },
      { nombre: "Activar ads", dia: 0 },
    ],
  },
  {
    id: "video",
    label: "Video",
    palabras: ["video", "spot", "comercial", "youtube", "documental", "entrevista"],
    pasos: [
      { nombre: "Guion", dia: -6 },
      { nombre: "Grabación", dia: -4 },
      { nombre: "Edición", dia: -2 },
      { nombre: "Aprobación del cliente", dia: -1 },
      { nombre: "Entregar", dia: 0 },
    ],
  },
  {
    id: "post",
    label: "Post",
    palabras: ["post", "posts", "publicacion", "flyer", "arte", "artes", "pieza", "piezas", "diseno", "banner", "feed"],
    pasos: [
      { nombre: "Copy", dia: -2 },
      { nombre: "Diseño", dia: -1 },
      { nombre: "Aprobación del cliente", dia: -1 },
      { nombre: "Publicar", dia: 0 },
    ],
  },
  {
    id: "carrusel",
    label: "Carrusel",
    palabras: ["carrusel", "carrousel", "carousel"],
    pasos: [
      { nombre: "Copy", dia: -3 },
      { nombre: "Diseño de láminas", dia: -2 },
      { nombre: "Aprobación del cliente", dia: -1 },
      { nombre: "Publicar", dia: 0 },
    ],
  },
  {
    id: "historias",
    label: "Historias",
    palabras: ["historia", "historias", "story", "stories"],
    pasos: [
      { nombre: "Preparar contenido", dia: -1 },
      { nombre: "Publicar", dia: 0 },
    ],
  },
  {
    id: "fotos",
    label: "Fotos",
    palabras: ["sesion", "fotos", "foto", "fotografia", "fotografias", "shooting"],
    pasos: [
      { nombre: "Planificar la sesión", dia: -4 },
      { nombre: "Sesión de fotos", dia: -3 },
      { nombre: "Selección y edición", dia: -1 },
      { nombre: "Entregar al cliente", dia: 0 },
    ],
  },
  {
    id: "pauta",
    label: "Pauta",
    palabras: ["pauta", "pautas", "ads", "campana", "anuncio", "anuncios", "publicidad", "meta ads"],
    pasos: [
      { nombre: "Público y presupuesto", dia: -3 },
      { nombre: "Crear anuncios", dia: -2 },
      { nombre: "Aprobación del cliente", dia: -1 },
      { nombre: "Lanzar campaña", dia: 0 },
      { nombre: "Revisar resultados", dia: 3 },
    ],
  },
  {
    id: "cobertura",
    label: "Cobertura",
    palabras: ["cobertura", "evento", "eventos", "inauguracion", "lanzamiento"],
    pasos: [
      { nombre: "Cobertura del evento", dia: 0 },
      { nombre: "Edición", dia: 1 },
      { nombre: "Entregar", dia: 1 },
    ],
  },
  {
    id: "informe",
    label: "Informe",
    palabras: ["informe", "reporte", "metricas", "estadisticas", "resultados del mes"],
    pasos: [
      { nombre: "Recopilar métricas", dia: -2 },
      { nombre: "Armar informe", dia: -1 },
      { nombre: "Enviar al cliente", dia: 0 },
    ],
  },
  {
    id: "otro",
    label: "Otro",
    palabras: [],
    pasos: [{ nombre: "Hacer", dia: 0 }],
  },
];

export function tipoDe(id: string) {
  return TIPOS.find((tipo) => tipo.id === id) || TIPOS[TIPOS.length - 1];
}

export function normalizar(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizar(texto: string) {
  const limpio = texto.trim().replace(/\s+/g, " ");
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : "";
}

// Pasos con fecha a partir de la entrega. Ningún paso cae antes de hoy
// y las fechas nunca retroceden de un paso al siguiente.
export function pasosConFecha(tipoId: string, entrega: string | null, hoy = fechaEnCaracas()) {
  const tipo = tipoDe(tipoId);
  let anterior = hoy;
  return tipo.pasos.map((paso) => {
    if (!entrega) return { nombre: paso.nombre, fecha: null as string | null };
    let fecha = sumarDias(entrega, paso.dia);
    if (fecha < anterior) fecha = anterior;
    anterior = fecha;
    return { nombre: paso.nombre, fecha };
  });
}

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function diaSemana(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function fechaValida(y: number, m: number, d: number) {
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Busca la fecha en la frase. Devuelve la fecha y el pedazo de texto que la nombró.
export function detectarFecha(texto: string, hoy = fechaEnCaracas()): { fecha: string; trozo: string } | null {
  const t = normalizar(texto);
  const [hy, hm, hd] = hoy.split("-").map(Number);
  let m: RegExpMatchArray | null;

  if ((m = t.match(/\b(?:para |el )?pasado manana\b/))) return { fecha: sumarDias(hoy, 2), trozo: m[0] };
  if ((m = t.match(/\b(?:para )?manana\b/))) return { fecha: sumarDias(hoy, 1), trozo: m[0] };
  if ((m = t.match(/\b(?:para )?hoy\b/))) return { fecha: hoy, trozo: m[0] };
  if ((m = t.match(/\ben (\d{1,2}) dias?\b/))) return { fecha: sumarDias(hoy, Number(m[1])), trozo: m[0] };
  if ((m = t.match(/\b(?:para )?la (?:proxima|otra) semana\b/))) return { fecha: sumarDias(hoy, 7), trozo: m[0] };
  if ((m = t.match(/\b(?:para )?(?:el )?fin de mes\b/))) {
    const ultimo = new Date(Date.UTC(hy, hm, 0)).getUTCDate();
    return { fecha: iso(hy, hm, ultimo), trozo: m[0] };
  }

  for (m of t.matchAll(/\b(?:para )?(?:el )?(\d{1,2})(?: de (\w+)|\/(\d{1,2})(?:\/(\d{2,4}))?)?\b/g)) {
    if (m[2] && !MESES.includes(m[2])) continue;
    if (!m[2] && !m[3] && !/\b(?:para |el )/.test(m[0])) continue;
    const dia = Number(m[1]);
    let mes = m[2] ? MESES.indexOf(m[2]) + 1 : m[3] ? Number(m[3]) : hm;
    let anio = m[4] ? Number(m[4].length === 2 ? `20${m[4]}` : m[4]) : hy;
    if (!m[2] && !m[3] && dia < hd) {
      mes += 1;
      if (mes > 12) {
        mes = 1;
        anio += 1;
      }
    } else if (!m[4] && iso(anio, mes, dia) < hoy) {
      anio += 1;
    }
    if (fechaValida(anio, mes, dia)) return { fecha: iso(anio, mes, dia), trozo: m[0] };
  }
  m = null;

  m = t.match(/\b(?:para )?(?:el )?(?:proximo )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (m) {
    const objetivo = DIAS.indexOf(m[1]);
    let salto = (objetivo - diaSemana(hoy) + 7) % 7;
    if (salto === 0) salto = 7;
    return { fecha: sumarDias(hoy, salto), trozo: m[0] };
  }
  return null;
}

export function detectarTipo(texto: string) {
  const t = ` ${normalizar(texto)} `;
  let mejor: { tipo: Tipo; pos: number } | null = null;
  for (const tipo of TIPOS) {
    for (const palabra of tipo.palabras) {
      const pos = t.indexOf(` ${palabra} `);
      if (pos >= 0 && (!mejor || pos < mejor.pos)) mejor = { tipo, pos };
    }
  }
  return mejor ? mejor.tipo : TIPOS[TIPOS.length - 1];
}

export type Detectado = {
  titulo: string;
  tipo: string;
  fecha_entrega: string | null;
  cuenta_id: number | null;
  urgente: boolean;
};

export function detectar(
  texto: string,
  clientes: { id: number; nombre_cliente: string }[],
  hoy = fechaEnCaracas(),
): Detectado {
  let resto = ` ${normalizar(texto)} `;
  const urgente = /\b(urgente|urge|ya mismo)\b/.test(resto);
  resto = resto.replace(/\b(urgente|urge|ya mismo)\b/g, " ");

  let cuentaId: number | null = null;
  const porLargo = [...clientes].sort((a, b) => b.nombre_cliente.length - a.nombre_cliente.length);
  for (const cliente of porLargo) {
    const nombre = normalizar(cliente.nombre_cliente);
    if (nombre && resto.includes(` ${nombre} `)) {
      cuentaId = cliente.id;
      resto = resto.replace(new RegExp(`\\s(?:para|de|del)?\\s*(?:el|la|los|las)?\\s*${nombre}\\s`), " ");
      break;
    }
  }

  const fecha = detectarFecha(resto, hoy);
  if (fecha) resto = resto.replace(fecha.trozo, " ");

  const tipo = detectarTipo(texto);
  resto = resto
    .replace(/^\s*(?:nuevo|nueva|hay que hacer|hacer|anota|anotar|agrega|agregar)\s+/, " ")
    .replace(/\s(?:para|de|del|el|la|con|y)\s*$/g, " ")
    .replace(/\s(?:para|de|del|el|la|con|y)\s*$/g, " ")
    .trim();

  // El título usa las palabras originales (con acentos) cuando se puede.
  const original = texto.trim().replace(/\s+/g, " ");
  const conAcento = new Map<string, string>();
  for (const palabra of original.split(" ")) {
    const limpia = palabra.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const clave = normalizar(limpia);
    if (clave && !conAcento.has(clave)) conAcento.set(clave, limpia);
  }
  const titulo = resto
    .split(" ")
    .filter(Boolean)
    .map((palabra) => conAcento.get(palabra) ?? palabra)
    .join(" ");

  return {
    titulo: capitalizar(titulo || resto || original),
    tipo: tipo.id,
    fecha_entrega: fecha ? fecha.fecha : null,
    cuenta_id: cuentaId,
    urgente,
  };
}

// Lo que toca ahora en un encargo: el primer paso sin hacer.
export type PasoMin = { id: number; orden: number; nombre: string; fecha: string | null; hecho_en: string | null };

export function siguientePaso<T extends PasoMin>(pasos: T[]) {
  return [...pasos].sort((a, b) => a.orden - b.orden || a.id - b.id).find((paso) => !paso.hecho_en) || null;
}

export function progreso(pasos: PasoMin[]) {
  const hechos = pasos.filter((paso) => paso.hecho_en).length;
  return { hechos, total: pasos.length };
}

export type Grupo = "atrasado" | "hoy" | "pronto" | "luego" | "sin_fecha";

export function grupoDe(fecha: string | null, hoy = fechaEnCaracas()): Grupo {
  if (!fecha) return "sin_fecha";
  if (fecha < hoy) return "atrasado";
  if (fecha === hoy) return "hoy";
  if (fecha <= sumarDias(hoy, 7)) return "pronto";
  return "luego";
}
