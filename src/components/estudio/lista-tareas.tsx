"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ESTADOS, etiquetaEstado, etiquetaPrioridad, fieldClass } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/fechas";
import { api } from "@/lib/api-client";
import { useEstudio } from "./contexto";
import type { Historial } from "./tipos";

export function ListaTareas() {
  const { tareas, onEditar, onMover, eliminar } = useEstudio();
  const [filtro, setFiltro] = useState("todas");
  const [abierta, setAbierta] = useState<number | null>(null);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [cargando, setCargando] = useState(false);
  const visibles = filtro === "todas" ? tareas : tareas.filter((tarea) => tarea.estado === filtro);

  async function verHistorial(id: number) {
    if (abierta === id) {
      setAbierta(null);
      return;
    }
    setAbierta(id);
    setHistorial([]);
    setCargando(true);
    try {
      const data = await api<{ historial: Historial[] }>(`/api/natvisual/tareas/${id}/historial`);
      setHistorial(data.historial || []);
    } catch {
      setHistorial([]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          type="button"
          variant="outline"
          className={filtro === "todas" ? "border-amber-400/50 bg-amber-400/15 text-amber-100" : "border-zinc-800 text-zinc-400"}
          onClick={() => setFiltro("todas")}
        >
          Todas
        </Button>
        {ESTADOS.map((estado) => (
          <Button
            key={estado.id}
            type="button"
            variant="outline"
            className={filtro === estado.id ? "border-amber-400/50 bg-amber-400/15 text-amber-100" : "border-zinc-800 text-zinc-400"}
            onClick={() => setFiltro(estado.id)}
          >
            {estado.label}
          </Button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <p className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4 text-sm text-zinc-400">
          No hay entregas en esta vista.
        </p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((tarea) => (
            <li key={tarea.id} className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-medium text-white">{tarea.titulo}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {tarea.nombre_cliente} · {formatearFecha(tarea.fecha_entrega)} · {etiquetaPrioridad(tarea)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="border-zinc-800" onClick={() => onEditar(tarea)}>
                    Editar
                  </Button>
                  <Button type="button" variant="outline" className="border-zinc-800" onClick={() => verHistorial(tarea.id)}>
                    Historial
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => void eliminar(tarea)}>
                    Borrar
                  </Button>
                </div>
              </div>
              <label className="mt-3 block text-xs text-zinc-500" htmlFor={`estado-${tarea.id}`}>
                Estado
                <select
                  id={`estado-${tarea.id}`}
                  className={`${fieldClass} mt-1`}
                  value={tarea.estado}
                  onChange={(event) => void onMover(tarea.id, event.target.value)}
                >
                  {ESTADOS.map((estado) => (
                    <option key={estado.id} value={estado.id}>
                      {estado.label}
                    </option>
                  ))}
                </select>
              </label>
              {abierta === tarea.id ? (
                <ol className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                  {cargando ? <li className="text-sm text-zinc-500">Cargando historial…</li> : null}
                  {!cargando && historial.length === 0 ? (
                    <li className="text-sm text-zinc-500">Sin movimientos.</li>
                  ) : null}
                  {historial.map((item) => (
                    <li key={item.id} className="text-sm text-zinc-300">
                      <span className="text-zinc-500">
                        {new Date(item.creado_en).toLocaleString("es-VE", { timeZone: "America/Caracas" })}
                      </span>
                      {" · "}
                      {item.estado_anterior
                        ? `${etiquetaEstado(item.estado_anterior)} → ${etiquetaEstado(item.estado_nuevo)}`
                        : `Creada como ${etiquetaEstado(item.estado_nuevo)}`}
                      {item.nota ? ` · ${item.nota}` : ""}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
