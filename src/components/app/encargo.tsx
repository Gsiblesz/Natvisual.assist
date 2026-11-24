"use client";

import { Flame, Pencil, Plus, Trash2 } from "lucide-react";
import { useIr } from "./nav";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { fieldClass, selectClass } from "@/lib/etiquetas";
import { cuando } from "@/lib/fechas";
import { progreso, siguientePaso, tipoDe, TIPOS } from "@/lib/plan";
import { useApp } from "./estado";
import {
  Barra,
  Circulo,
  colorFecha,
  Hoja,
  Pantalla,
  Vacio,
  botonPeligro,
  botonPrincipal,
} from "./piezas";
import type { Paso, Tarea } from "./tipos";

export function Encargo({ id }: { id: number }) {
  const { tareas, cuentas, marcarPaso, reemplazarTarea, recargar, avisar } = useApp();
  const router = useIr();
  const tarea = tareas.find((item) => item.id === id);
  const [editandoPaso, setEditandoPaso] = useState<Paso | null>(null);
  const [pasoNombre, setPasoNombre] = useState("");
  const [pasoFecha, setPasoFecha] = useState("");
  const [nuevoPaso, setNuevoPaso] = useState("");
  const [editar, setEditar] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [form, setForm] = useState({ titulo: "", tipo: "otro", fecha_entrega: "", urgente: false, cuenta_id: 0 });
  const [notas, setNotas] = useState(tarea?.descripcion ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const cerrarPaso = useCallback(() => {
    setEditandoPaso(null);
    setConfirmarQuitar(false);
  }, []);
  const cerrarEditar = useCallback(() => setEditar(false), []);
  const cerrarBorrar = useCallback(() => setBorrar(false), []);

  const descripcion = tarea?.descripcion;
  useEffect(() => {
    if (descripcion !== undefined) setNotas(descripcion);
  }, [descripcion]);

  if (saliendo) return null;

  if (!tarea) {
    return (
      <Pantalla titulo="Encargo" volver={{ href: "/natvisual", label: "Hoy" }}>
        <Vacio>Ese encargo ya no existe.</Vacio>
      </Pantalla>
    );
  }

  const actual = tarea;
  const pasos = [...actual.pasos].sort((a, b) => a.orden - b.orden || a.id - b.id);
  const sigue = siguientePaso(pasos);
  const { hechos, total } = progreso(pasos);

  async function guardar<T extends { tarea: Tarea }>(ruta: string, metodo: string, cuerpo?: unknown) {
    setOcupado(true);
    try {
      const datos = await api<T>(ruta, {
        method: metodo,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
      reemplazarTarea(datos.tarea);
      return true;
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function guardarNotas() {
    if (notas === actual.descripcion) return;
    if (await guardar(`/api/natvisual/tareas/${actual.id}`, "PATCH", { descripcion: notas })) avisar("Notas guardadas.");
  }

  async function borrarEncargo() {
    setOcupado(true);
    try {
      await api(`/api/natvisual/tareas/${actual.id}`, { method: "DELETE" });
      setSaliendo(true);
      avisar(`${actual.titulo} se borró.`, undefined, true);
      router.replace(`/natvisual/clientes/${actual.cuenta_id}`);
      await recargar();
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo borrar.");
      setOcupado(false);
    }
  }

  return (
    <Pantalla
      titulo={actual.titulo}
      sobre={`${actual.nombre_cliente} · ${tipoDe(actual.tipo).label}`}
      volver={{ href: `/natvisual/clientes/${actual.cuenta_id}`, label: actual.nombre_cliente }}
    >
      <div className="-mt-2 mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full bg-zinc-900 px-3 py-1.5 ${colorFecha(actual.estado === "hecho" ? null : actual.fecha_entrega)}`}>
            Entrega: {actual.fecha_entrega ? cuando(actual.fecha_entrega) : "sin fecha"}
          </span>
          {actual.urgente ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1.5 text-red-200">
              <Flame className="size-4" aria-hidden />
              Urgente
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setForm({
                titulo: actual.titulo,
                tipo: actual.tipo,
                fecha_entrega: actual.fecha_entrega || "",
                urgente: actual.urgente,
                cuenta_id: actual.cuenta_id,
              });
              setEditar(true);
            }}
            className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-amber-300"
          >
            <Pencil className="size-4" aria-hidden />
            Editar
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Barra hechos={hechos} total={total} />
          <span className="shrink-0 text-sm text-zinc-400">
            {hechos} de {total}
          </span>
        </div>
        <p className="text-[15px] text-zinc-300">
          {sigue ? (
            <>
              Ahora toca: <span className="font-medium text-amber-200">{sigue.nombre}</span>
            </>
          ) : (
            <span className="text-emerald-300">Todo listo. Este encargo está terminado.</span>
          )}
        </p>
      </div>

      <ol className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/60">
        {pasos.map((paso, indice) => {
          const esSiguiente = sigue?.id === paso.id;
          const fecha = paso.fecha;
          return (
            <li
              key={paso.id}
              className={`flex items-center gap-1 py-1 pr-2 pl-1 ${indice ? "border-t border-zinc-800/80" : ""} ${
                esSiguiente ? "bg-amber-400/5" : ""
              }`}
            >
              <Circulo
                hecho={Boolean(paso.hecho_en)}
                etiqueta={paso.hecho_en ? `Reabrir ${paso.nombre}` : `Marcar ${paso.nombre} como hecho`}
                onClick={() => void marcarPaso(actual, paso.id, !paso.hecho_en)}
              />
              <button
                type="button"
                className="min-h-14 min-w-0 flex-1 py-2 text-left"
                onClick={() => {
                  setPasoNombre(paso.nombre);
                  setPasoFecha(paso.fecha || "");
                  setConfirmarQuitar(false);
                  setEditandoPaso(paso);
                }}
              >
                <span
                  className={`block truncate text-[17px] ${
                    paso.hecho_en ? "text-zinc-500 line-through" : esSiguiente ? "font-medium text-zinc-50" : "text-zinc-200"
                  }`}
                >
                  <span className="mr-2 text-sm text-zinc-600">{indice + 1}</span>
                  {paso.nombre}
                </span>
                <span className={`block text-sm ${paso.hecho_en ? "text-zinc-600" : colorFecha(fecha)}`}>
                  {paso.hecho_en ? "Hecho" : fecha ? cuando(fecha) : "Sin fecha"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <form
        className="mt-3 flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!nuevoPaso.trim()) return;
          if (await guardar(`/api/natvisual/tareas/${actual.id}/pasos`, "POST", { nombre: nuevoPaso.trim() })) {
            setNuevoPaso("");
          }
        }}
      >
        <input
          className={fieldClass}
          value={nuevoPaso}
          onChange={(event) => setNuevoPaso(event.target.value)}
          placeholder="Añadir otro paso"
          aria-label="Nombre del paso nuevo"
          enterKeyHint="done"
        />
        <button
          type="submit"
          aria-label="Añadir paso"
          disabled={ocupado || !nuevoPaso.trim()}
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-zinc-800 text-amber-300 disabled:opacity-40"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </form>

      <label htmlFor="nv-notas" className="mt-6 mb-2 block px-1 text-[13px] font-semibold tracking-wide text-zinc-400 uppercase">
        Notas
      </label>
      <textarea
        id="nv-notas"
        rows={3}
        value={notas}
        onChange={(event) => setNotas(event.target.value)}
        onBlur={() => void guardarNotas()}
        placeholder="Referencias, links, lo que pidió el cliente…"
        className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none placeholder:text-zinc-500 focus-visible:border-amber-400/70"
      />

      <button type="button" className={`${botonPeligro} mt-8`} onClick={() => setBorrar(true)}>
        <Trash2 className="size-5" aria-hidden />
        Borrar encargo
      </button>

      <Hoja abierta={editandoPaso !== null} titulo="Paso" onCerrar={cerrarPaso}>
        {editandoPaso ? (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const ok = await guardar(`/api/natvisual/pasos/${editandoPaso.id}`, "PATCH", {
                nombre: pasoNombre,
                fecha: pasoFecha || null,
              });
              if (ok) setEditandoPaso(null);
            }}
          >
            <div>
              <label htmlFor="nv-paso-nombre" className="text-sm text-zinc-400">
                Nombre
              </label>
              <input
                id="nv-paso-nombre"
                className={`${fieldClass} mt-1`}
                value={pasoNombre}
                onChange={(event) => setPasoNombre(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="nv-paso-fecha" className="text-sm text-zinc-400">
                Fecha
              </label>
              <input
                id="nv-paso-fecha"
                type="date"
                className={`${fieldClass} mt-1`}
                value={pasoFecha}
                onChange={(event) => setPasoFecha(event.target.value)}
              />
            </div>
            <button type="submit" disabled={ocupado || !pasoNombre.trim()} className={botonPrincipal}>
              Guardar paso
            </button>
            <button
              type="button"
              disabled={ocupado || pasos.length <= 1}
              className={botonPeligro}
              onClick={async () => {
                // Pide un segundo toque: el botón está justo debajo de «Guardar paso».
                if (!confirmarQuitar) {
                  setConfirmarQuitar(true);
                  return;
                }
                if (await guardar(`/api/natvisual/pasos/${editandoPaso.id}`, "DELETE")) {
                  avisar(`Quitaste «${editandoPaso.nombre}».`);
                  cerrarPaso();
                }
              }}
            >
              <Trash2 className="size-5" aria-hidden />
              {confirmarQuitar ? "Toca otra vez para quitarlo" : "Quitar este paso"}
            </button>
          </form>
        ) : null}
      </Hoja>

      <Hoja abierta={editar} titulo="Editar encargo" onCerrar={cerrarEditar}>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await guardar(`/api/natvisual/tareas/${actual.id}`, "PATCH", {
              ...form,
              fecha_entrega: form.fecha_entrega || null,
            });
            if (ok) {
              setEditar(false);
              avisar("Encargo guardado.");
            }
          }}
        >
          <div>
            <label htmlFor="nv-ed-titulo" className="text-sm text-zinc-400">
              Qué es
            </label>
            <input
              id="nv-ed-titulo"
              className={`${fieldClass} mt-1`}
              value={form.titulo}
              onChange={(event) => setForm({ ...form, titulo: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="nv-ed-cliente" className="text-sm text-zinc-400">
              Cliente
            </label>
            <select
              id="nv-ed-cliente"
              className={`${selectClass} mt-1`}
              value={form.cuenta_id}
              onChange={(event) => setForm({ ...form, cuenta_id: Number(event.target.value) })}
            >
              {cuentas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre_cliente}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nv-ed-tipo" className="text-sm text-zinc-400">
              Tipo
            </label>
            <select
              id="nv-ed-tipo"
              className={`${selectClass} mt-1`}
              value={form.tipo}
              onChange={(event) => setForm({ ...form, tipo: event.target.value })}
            >
              {TIPOS.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">Cambiar el tipo no cambia los pasos que ya tiene.</p>
          </div>
          <div>
            <label htmlFor="nv-ed-fecha" className="text-sm text-zinc-400">
              Fecha de entrega
            </label>
            <input
              id="nv-ed-fecha"
              type="date"
              className={`${fieldClass} mt-1`}
              value={form.fecha_entrega}
              onChange={(event) => setForm({ ...form, fecha_entrega: event.target.value })}
            />
          </div>
          <button
            type="button"
            aria-pressed={form.urgente}
            onClick={() => setForm({ ...form, urgente: !form.urgente })}
            className={`inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border px-4 text-[15px] ${
              form.urgente ? "border-red-400/50 bg-red-500/15 text-red-200" : "border-zinc-800 bg-zinc-950 text-zinc-400"
            }`}
          >
            <Flame className="size-4" aria-hidden />
            {form.urgente ? "Urgente" : "Marcar como urgente"}
          </button>
          <button type="submit" disabled={ocupado || !form.titulo.trim()} className={botonPrincipal}>
            Guardar
          </button>
        </form>
      </Hoja>

      <Hoja abierta={borrar} titulo="¿Borrar encargo?" onCerrar={cerrarBorrar}>
        <p className="mb-5 text-[16px] text-zinc-200">
          Se borra «{actual.titulo}» con sus {total} pasos. No se puede deshacer.
        </p>
        <button type="button" disabled={ocupado} className={botonPeligro} onClick={() => void borrarEncargo()}>
          <Trash2 className="size-5" aria-hidden />
          Borrar para siempre
        </button>
      </Hoja>
    </Pantalla>
  );
}
