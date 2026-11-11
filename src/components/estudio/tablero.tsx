"use client";

import { ESTADOS, etiquetaPrioridad } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/fechas";
import { useEstudio } from "./contexto";

export function Tablero() {
  const { tareas, onMover, onEditar } = useEstudio();
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {ESTADOS.map((estado) => {
        const columna = tareas.filter((tarea) => tarea.estado === estado.id);
        return (
          <section
            key={estado.id}
            className="flex w-[85vw] shrink-0 snap-start flex-col rounded-3xl border border-zinc-800/80 bg-zinc-900/40 sm:w-80 lg:w-auto lg:min-w-0 lg:flex-1"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = Number(event.dataTransfer.getData("text/plain"));
              if (id) void onMover(id, estado.id);
            }}
          >
            <header className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">{estado.columna}</h2>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                {columna.length}
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
              {columna.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-800 px-3 py-6 text-center text-sm text-zinc-500">
                  Nada en esta columna
                </p>
              ) : null}
              {columna.map((tarea) => (
                <article
                  key={tarea.id}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", String(tarea.id))}
                  className="cursor-grab rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 active:cursor-grabbing"
                >
                  <button type="button" className="w-full text-left" onClick={() => onEditar(tarea)}>
                    <p className="font-medium text-zinc-50">{tarea.titulo}</p>
                    <p className="mt-1 text-sm text-zinc-400">{tarea.nombre_cliente}</p>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-amber-400/10 px-2 py-1 text-amber-100">
                      {etiquetaPrioridad(tarea)}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-300">
                      {formatearFecha(tarea.fecha_entrega)}
                    </span>
                    {tarea.etiqueta ? (
                      <span className="rounded-full bg-zinc-800 px-2 py-1 text-zinc-400">{tarea.etiqueta}</span>
                    ) : null}
                  </div>
                  <label className="mt-3 block text-xs text-zinc-500" htmlFor={`mover-${tarea.id}`}>
                    Mover
                    <select
                      id={`mover-${tarea.id}`}
                      className="mt-1 h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100"
                      value={tarea.estado}
                      onChange={(event) => void onMover(tarea.id, event.target.value)}
                    >
                      {ESTADOS.map((opcion) => (
                        <option key={opcion.id} value={opcion.id}>
                          {opcion.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
