export function sumarDias(fecha: string, dias: number) {
  const [year, month, day] = String(fecha).slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

export function fechaEnCaracas(ahora: Date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(ahora)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function rangoMes(anio: number, mes: number) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const fin =
    mes === 12
      ? `${anio + 1}-01-01`
      : `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
  return { inicio, fin };
}

export function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return "Sin fecha";
  const [year, month, day] = String(fecha).slice(0, 10).split("-");
  return day ? `${day}/${month}/${year}` : "Sin fecha";
}

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function partes(fecha: string) {
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  return { y, m, d, dia: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

export function diasEntre(desde: string, hasta: string) {
  const a = partes(desde);
  const b = partes(hasta);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

// «Hoy», «Mañana», «Ayer», «Hace 3 días» o «vie 27/11».
export function cuando(fecha: string | null | undefined, hoy = fechaEnCaracas()) {
  if (!fecha) return "Sin fecha";
  const diferencia = diasEntre(hoy, fecha);
  if (diferencia === 0) return "Hoy";
  if (diferencia === 1) return "Mañana";
  if (diferencia === -1) return "Ayer";
  if (diferencia < -1 && diferencia > -8) return `Hace ${-diferencia} días`;
  const { d, m, dia } = partes(fecha);
  return `${DIAS_CORTOS[dia]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export function fechaLarga(fecha = fechaEnCaracas()) {
  const { d, m, dia } = partes(fecha);
  return `${DIAS_LARGOS[dia]} ${d} de ${MESES[m - 1]}`;
}
