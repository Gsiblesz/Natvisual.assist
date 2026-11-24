"use client";

import { Enlace as Link } from "./nav";
import { ChevronRight, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { fieldClass } from "@/lib/etiquetas";
import { cuando, fechaEnCaracas } from "@/lib/fechas";
import { siguientePaso } from "@/lib/plan";
import { useApp } from "./estado";
import { colorFecha, Pantalla, Vacio, botonPrincipal } from "./piezas";
import type { Cuenta, EstadoCliente } from "./tipos";

const FILTROS: { id: EstadoCliente; label: string; vacio: string }[] = [
  { id: "activo", label: "Activos", vacio: "Todavía no tienes clientes activos. Añade el primero arriba." },
  { id: "inactivo", label: "Inactivos", vacio: "Aquí quedan los clientes en pausa. Sus encargos no salen en Hoy." },
  { id: "archivado", label: "Archivo", vacio: "Aquí quedan los clientes que ya no trabajan contigo. No se borra nada." },
];

export function Clientes() {
  const { cuentas, tareas, recargar, avisar } = useApp();
  const params = useSearchParams();
  const [filtro, setFiltro] = useState<EstadoCliente>("activo");
  const [creando, setCreando] = useState(params.get("nuevo") === "1");
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const hoy = fechaEnCaracas();

  const porCliente = useMemo(() => {
    const mapa = new Map<number, { abiertos: number; atrasados: number; sigue: string; fecha: string | null }>();
    for (const tarea of tareas) {
      if (tarea.estado === "hecho") continue;
      const dato = mapa.get(tarea.cuenta_id) || { abiertos: 0, atrasados: 0, sigue: "", fecha: null };
      dato.abiertos += 1;
      const paso = siguientePaso(tarea.pasos);
      const fecha = paso?.fecha || tarea.fecha_entrega;
      if (fecha && fecha < hoy) dato.atrasados += 1;
      if (paso && (!dato.sigue || (fecha && (!dato.fecha || fecha < dato.fecha)))) {
        dato.sigue = paso.nombre;
        dato.fecha = fecha;
      }
      mapa.set(tarea.cuenta_id, dato);
    }
    return mapa;
  }, [tareas, hoy]);

  const lista = cuentas.filter((cuenta) => cuenta.estado === filtro);

  async function crear(event: React.FormEvent) {
    event.preventDefault();
    if (!nombre.trim()) return;
    setOcupado(true);
    try {
      await api<{ cuenta: Cuenta }>("/api/admin/cuentas", {
        method: "POST",
        body: JSON.stringify({ nombre_cliente: nombre.trim() }),
      });
      avisar(`${nombre.trim()} quedó en tus clientes activos.`);
      setNombre("");
      setCreando(false);
      setFiltro("activo");
      await recargar();
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo crear el cliente.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Pantalla
      titulo="Clientes"
      accion={
        !creando ? (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="inline-flex min-h-11 items-center gap-1 rounded-full bg-zinc-900 px-4 text-[15px] font-medium text-amber-300"
          >
            <Plus className="size-4" aria-hidden />
            Nuevo
          </button>
        ) : null
      }
    >
      {creando ? (
        <form onSubmit={crear} className="mb-5 space-y-2 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4">
          <label htmlFor="nv-nuevo-cliente" className="text-sm text-zinc-400">
            Nombre del cliente
          </label>
          <input
            id="nv-nuevo-cliente"
            autoFocus
            className={fieldClass}
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Ej.: Hotel Mar"
            autoCapitalize="words"
            enterKeyHint="done"
          />
          <div className="flex gap-2 pt-1">
            <button type="submit" className={botonPrincipal} disabled={ocupado || !nombre.trim()}>
              Añadir
            </button>
            <button
              type="button"
              className="min-h-12 shrink-0 rounded-2xl px-4 text-zinc-400"
              onClick={() => {
                setCreando(false);
                setNombre("");
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-zinc-900 p-1" role="tablist">
        {FILTROS.map((item) => {
          const cuantos = cuentas.filter((cuenta) => cuenta.estado === item.id).length;
          const on = filtro === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFiltro(item.id)}
              className={`min-h-10 rounded-xl text-sm font-medium ${on ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
            >
              {item.label} <span className={on ? "text-zinc-300" : "text-zinc-600"}>{cuantos}</span>
            </button>
          );
        })}
      </div>

      {lista.length === 0 ? (
        <Vacio>{FILTROS.find((item) => item.id === filtro)?.vacio}</Vacio>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/60">
          {lista.map((cuenta, indice) => {
            const dato = porCliente.get(cuenta.id);
            return (
              <li key={cuenta.id} className={indice ? "border-t border-zinc-800/80" : ""}>
                <Link
                  href={`/natvisual/clientes/${cuenta.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-zinc-800/60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-800 font-heading text-lg text-amber-200">
                    {cuenta.nombre_cliente.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] text-zinc-50">{cuenta.nombre_cliente}</span>
                    <span className="block truncate text-sm text-zinc-500">
                      {dato
                        ? `${dato.abiertos} ${dato.abiertos === 1 ? "abierto" : "abiertos"}`
                        : "Sin encargos abiertos"}
                      {dato?.sigue ? (
                        <>
                          {" · "}
                          {dato.sigue}
                          {dato.fecha ? <span className={colorFecha(dato.fecha)}> {cuando(dato.fecha).toLowerCase()}</span> : null}
                        </>
                      ) : null}
                    </span>
                  </span>
                  {dato?.atrasados ? (
                    <span className="grid min-w-6 shrink-0 place-items-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {dato.atrasados}
                    </span>
                  ) : null}
                  <ChevronRight className="size-5 shrink-0 text-zinc-600" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Pantalla>
  );
}
