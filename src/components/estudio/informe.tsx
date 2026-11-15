"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, descargarInforme } from "@/lib/api-client";
import { etiquetaEstado, fieldClass } from "@/lib/etiquetas";
import { fechaEnCaracas, formatearFecha } from "@/lib/fechas";
import { useEstudio } from "./contexto";
import type { Tarea } from "./tipos";

function mesActual() {
  return fechaEnCaracas().slice(0, 7);
}

export function Informe() {
  const { cuentaId, tareas } = useEstudio();
  const [mes, setMes] = useState(mesActual);
  const [purgar, setPurgar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [reporte, setReporte] = useState<{
    resumen: { total: number; pendiente: number; en_progreso: number; hecho: number };
    tareas: Tarea[];
  } | null>(null);

  useEffect(() => {
    let vivo = true;
    const [anio, mesNumero] = mes.split("-").map(Number);
    setError("");
    const params = new URLSearchParams({ anio: String(anio), mes: String(mesNumero) });
    if (cuentaId !== "todas") params.set("cuenta_id", cuentaId);
    api<{ resumen: { total: number; pendiente: number; en_progreso: number; hecho: number }; tareas: Tarea[] }>(
      `/api/natvisual/informe?${params}`,
    )
      .then((data) => {
        if (vivo) setReporte(data);
      })
      .catch((err: Error) => {
        if (vivo) setError(err.message);
      });
    return () => {
      vivo = false;
    };
    // tareas cambia cuando alguien del equipo mueve algo: el informe se vuelve a pedir
  }, [cuentaId, mes, tareas]);

  async function descargar() {
    if (purgar) {
      const texto =
        cuentaId === "todas"
          ? "Elige un cliente antes de borrar entregas hechas."
          : "Se borrarán del servidor las tareas hechas de este mes. El ZIP queda como copia. ¿Seguimos?";
      if (cuentaId === "todas") {
        setError(texto);
        return;
      }
      if (!window.confirm(texto)) return;
    }
    setOcupado(true);
    setError("");
    setOk("");
    try {
      const [anio, mesNumero] = mes.split("-").map(Number);
      const resultado = await descargarInforme({ cuentaId, anio, mes: mesNumero, purgar });
      setOk(
        purgar
          ? `Archivo descargado. Se borraron ${resultado.purgadas} entregas hechas.`
          : "Archivo descargado. No se borró nada.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo armar el informe.");
    } finally {
      setOcupado(false);
    }
  }

  const resumen = reporte?.resumen;

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Informe mensual</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            El ZIP trae las entregas, el historial, los avisos y un calendario del mes. Si lo pides,
            después borra las hechas para no llenar Neon.
          </p>
        </div>
        <div>
          <Label htmlFor="nv-mes" className="text-zinc-400">
            Mes
          </Label>
          <Input
            id="nv-mes"
            type="month"
            className={`${fieldClass} mt-1 max-w-xs`}
            value={mes}
            onChange={(event) => setMes(event.target.value)}
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <Checkbox checked={purgar} onCheckedChange={(valor) => setPurgar(Boolean(valor))} className="mt-0.5" />
          <span>Después de descargar, borrar las tareas hechas de este cliente y este mes.</span>
        </label>
        <Button
          type="button"
          className="h-11 bg-amber-500 text-zinc-950 hover:bg-amber-400"
          onClick={descargar}
          disabled={ocupado}
        >
          {ocupado ? "Armando ZIP…" : "Descargar ZIP"}
        </Button>
        {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </section>
      {!reporte && !error ? <p className="text-sm text-zinc-500">Cargando el mes…</p> : null}
      {resumen ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              ["Total", resumen.total],
              ["Pendientes", resumen.pendiente],
              ["En curso", resumen.en_progreso],
              ["Terminadas", resumen.hecho],
            ] as const
          ).map(([label, valor]) => (
            <div key={label} className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4">
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="mt-1 font-heading text-3xl font-medium text-white">{valor}</p>
            </div>
          ))}
        </div>
      ) : null}
      <ul className="space-y-2">
        {(reporte?.tareas || []).map((tarea) => (
          <li
            key={tarea.id}
            className="flex flex-col gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-zinc-50">{tarea.titulo}</p>
              <p className="text-sm text-zinc-500">
                {tarea.nombre_cliente} · {formatearFecha(tarea.fecha_entrega)}
              </p>
            </div>
            <p className="text-sm text-amber-100">{etiquetaEstado(tarea.estado)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
