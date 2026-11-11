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
