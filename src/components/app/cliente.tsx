"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, CirclePause, Ellipsis, Plus, Sun, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import { fieldClass } from "@/lib/etiquetas";
import { cuando } from "@/lib/fechas";
import { useApp } from "./estado";
import {
  Hoja,
  Pantalla,
  Seccion,
  TarjetaEncargo,
  Vacio,
  botonPeligro,
  botonPrincipal,
  botonSecundario,
} from "./piezas";
import type { EstadoCliente } from "./tipos";

const ETIQUETA: Record<EstadoCliente, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  archivado: "Archivado",
};

export function Cliente({ id }: { id: number }) {
  const { cuentas, tareas, recargar, avisar } = useApp();
  const router = useRouter();
  const cuenta = cuentas.find((item) => item.id === id);
  const [opciones, setOpciones] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [nombre, setNombre] = useState("");
  const [verTerminados, setVerTerminados] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const cerrarOpciones = useCallback(() => setOpciones(false), []);
  const cerrarBorrar = useCallback(() => setBorrar(false), []);

  if (!cuenta) {
    return (
      <Pantalla titulo="Cliente" volver={{ href: "/natvisual/clientes", label: "Clientes" }}>
        <Vacio>Ese cliente ya no existe.</Vacio>
      </Pantalla>
    );
  }

  const suyas = tareas.filter((tarea) => tarea.cuenta_id === id);
  const abiertas = suyas.filter((tarea) => tarea.estado !== "hecho");
  const terminadas = suyas
    .filter((tarea) => tarea.estado === "hecho")
    .sort((a, b) => (b.fecha_entrega || "").localeCompare(a.fecha_entrega || ""));

  async function cambiar(datos: { estado?: EstadoCliente; nombre_cliente?: string }, mensaje: string) {
    setOcupado(true);
    try {
      await api(`/api/admin/cuentas/${id}`, { method: "PATCH", body: JSON.stringify(datos) });
      await recargar();
      avisar(mensaje);
      setOpciones(false);
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }

  async function borrarCliente() {
    if (!cuenta) return;
    setOcupado(true);
    try {
      await api(`/api/admin/cuentas/${id}`, { method: "DELETE" });
      avisar(`${cuenta.nombre_cliente} se borró.`);
      router.replace("/natvisual/clientes");
      await recargar();
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo borrar.");
      setOcupado(false);
    }
  }

  const estados: { id: EstadoCliente; label: string; ayuda: string; icono: typeof Sun }[] = [
    { id: "activo", label: "Activo", ayuda: "Sus pasos salen en Hoy y en el resumen.", icono: Sun },
    { id: "inactivo", label: "Inactivo", ayuda: "En pausa. No sale en Hoy ni en el resumen.", icono: CirclePause },
    { id: "archivado", label: "Archivado", ayuda: "Ya no trabaja contigo. Se guarda todo.", icono: Archive },
  ];

  return (
    <Pantalla
      titulo={cuenta.nombre_cliente}
      volver={{ href: "/natvisual/clientes", label: "Clientes" }}
      accion={
        <button
          type="button"
          aria-label="Opciones del cliente"
          onClick={() => {
            setNombre(cuenta.nombre_cliente);
            setOpciones(true);
          }}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-zinc-900 text-amber-300"
        >
          <Ellipsis className="size-5" aria-hidden />
        </button>
      }
    >
      <div className="-mt-3 mb-5 flex items-center gap-2 text-sm">
        <span
          className={`rounded-full px-2.5 py-1 font-medium ${
            cuenta.estado === "activo"
              ? "bg-emerald-500/15 text-emerald-200"
              : cuenta.estado === "inactivo"
                ? "bg-zinc-800 text-zinc-300"
                : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {ETIQUETA[cuenta.estado]}
        </span>
        <span className="text-zinc-500">
          {abiertas.length} abiertos · {terminadas.length} terminados
        </span>
      </div>

      {cuenta.estado !== "activo" ? (
        <div className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 text-[15px] text-zinc-300">
          {cuenta.estado === "inactivo"
            ? "Este cliente está en pausa: sus pasos no salen en Hoy."
            : "Este cliente está archivado."}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void cambiar({ estado: "activo" }, `${cuenta.nombre_cliente} volvió a activos.`)}
            className={`${botonSecundario} mt-3`}
          >
            {cuenta.estado === "archivado" ? <ArchiveRestore className="size-5" aria-hidden /> : <Sun className="size-5" aria-hidden />}
            Volver a activo
          </button>
        </div>
      ) : null}

      <Link href={`/natvisual/nuevo?cliente=${id}`} className={`${botonPrincipal} mb-6`}>
        <Plus className="size-5" aria-hidden />
        Nuevo encargo
      </Link>

      <Seccion titulo="En curso">
        {abiertas.length ? (
          <div className="space-y-2">
            {abiertas.map((tarea) => (
              <TarjetaEncargo key={tarea.id} tarea={tarea} />
            ))}
          </div>
        ) : (
          <Vacio>No tiene encargos abiertos.</Vacio>
        )}
      </Seccion>

      {terminadas.length ? (
        <Seccion titulo="Terminados">
          <button
            type="button"
            className="mb-2 min-h-11 px-1 text-[15px] text-amber-300"
            onClick={() => setVerTerminados(!verTerminados)}
          >
            {verTerminados ? "Ocultar" : `Ver ${terminadas.length}`}
          </button>
          {verTerminados ? (
            <ul className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/60">
              {terminadas.map((tarea, indice) => (
                <li key={tarea.id} className={indice ? "border-t border-zinc-800/80" : ""}>
                  <Link href={`/natvisual/encargos/${tarea.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                    <span className="truncate text-zinc-200">{tarea.titulo}</span>
                    <span className="shrink-0 text-sm text-zinc-500">{cuando(tarea.fecha_entrega)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Seccion>
      ) : null}

      <Hoja abierta={opciones} titulo="Cliente" onCerrar={cerrarOpciones}>
        <form
          className="mb-6 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (nombre.trim() && nombre.trim() !== cuenta.nombre_cliente) {
              void cambiar({ nombre_cliente: nombre.trim() }, "Nombre guardado.");
            }
          }}
        >
          <label htmlFor="nv-renombrar" className="text-sm text-zinc-400">
            Nombre
          </label>
          <div className="flex gap-2">
            <input
              id="nv-renombrar"
              className={fieldClass}
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              autoCapitalize="words"
            />
            <button
              type="submit"
              disabled={ocupado || !nombre.trim() || nombre.trim() === cuenta.nombre_cliente}
              className="min-h-12 shrink-0 rounded-2xl bg-zinc-800 px-4 text-zinc-100 disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </form>

        <p className="mb-2 text-sm text-zinc-400">Estado</p>
        <div className="mb-6 space-y-2">
          {estados.map((estado) => {
            const Icono = estado.icono;
            const on = cuenta.estado === estado.id;
            return (
              <button
                key={estado.id}
                type="button"
                disabled={ocupado || on}
                onClick={() =>
                  void cambiar(
                    { estado: estado.id },
                    `${cuenta.nombre_cliente} pasó a ${ETIQUETA[estado.id].toLowerCase()}.`,
                  )
                }
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                  on ? "border-amber-400/50 bg-amber-400/10" : "border-zinc-800 bg-zinc-950 active:bg-zinc-800"
                }`}
              >
                <Icono className={`size-5 shrink-0 ${on ? "text-amber-300" : "text-zinc-400"}`} aria-hidden />
                <span>
                  <span className="block text-[16px] text-zinc-50">
                    {estado.label}
                    {on ? " · ahora" : ""}
                  </span>
                  <span className="block text-sm text-zinc-500">{estado.ayuda}</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={botonPeligro}
          onClick={() => {
            setOpciones(false);
            setBorrar(true);
          }}
        >
          <Trash2 className="size-5" aria-hidden />
          Borrar cliente
        </button>
      </Hoja>

      <Hoja abierta={borrar} titulo="¿Borrar cliente?" onCerrar={cerrarBorrar}>
        <p className="mb-2 text-[16px] text-zinc-200">
          Se borran {cuenta.nombre_cliente} y sus {suyas.length}{" "}
          {suyas.length === 1 ? "encargo" : "encargos"}, con todos sus pasos. No se puede deshacer.
        </p>
        <p className="mb-5 text-sm text-zinc-400">
          Si solo ya no trabaja contigo, mejor archívalo: desaparece de tu lista y no pierdes nada.
        </p>
        <div className="space-y-2">
          <button
            type="button"
            disabled={ocupado}
            className={botonSecundario}
            onClick={() => {
              setBorrar(false);
              void cambiar({ estado: "archivado" }, `${cuenta.nombre_cliente} pasó al archivo.`);
            }}
          >
            <Archive className="size-5" aria-hidden />
            Mejor archivarlo
          </button>
          <button type="button" disabled={ocupado} className={botonPeligro} onClick={() => void borrarCliente()}>
            <Trash2 className="size-5" aria-hidden />
            Borrar para siempre
          </button>
        </div>
      </Hoja>
    </Pantalla>
  );
}
