export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (response.status === 401) {
    if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
    throw new Error("No autorizado");
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "Error de API");
  return data as T;
}

export async function descargarInforme(input: {
  cuentaId: string;
  anio: number;
  mes: number;
  purgar: boolean;
}) {
  const response = await fetch("/api/natvisual/informe/zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cuenta_id: input.cuentaId === "todas" ? null : Number(input.cuentaId),
      anio: input.anio,
      mes: input.mes,
      purgar: input.purgar,
    }),
  });
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("No autorizado");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "No se pudo armar el informe");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `natvisual-${input.anio}-${String(input.mes).padStart(2, "0")}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { purgadas: Number(response.headers.get("X-Natvisual-Purgadas") || 0) };
}
