"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { etiquetaPrioridad, fieldClass } from "@/lib/etiquetas";
import { fechaEnCaracas, formatearFecha } from "@/lib/fechas";
import { useEstudio } from "./contexto";
import type { Calendario } from "./tipos";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function Agenda() {
  const estudio = useEstudio();
  const hoy = fechaEnCaracas();
  const [mes, setMes] = useState(() => {
    const [anio, mesNumero] = fechaEnCaracas().split("-").map(Number);
    return { anio, mes: mesNumero };
  });
  const [form, setForm] = useState<Calendario | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!estudio.calendario) {
      setForm(null);
      return;
    }
    setForm({
      proveedor: estudio.calendario.proveedor || "ics",
      correo_equipo: estudio.calendario.correo_equipo || "",
      google_calendar_id: estudio.calendario.google_calendar_id || "",
      aviso_horas: estudio.calendario.aviso_horas || 24,
    });
  }, [estudio.calendario]);

  const delMes = useMemo(
    () =>
      estudio.tareas.filter((tarea) => {
        if (!tarea.fecha_entrega) return false;
        const [anio, mesNumero] = tarea.fecha_entrega.split("-").map(Number);
        return anio === mes.anio && mesNumero === mes.mes;
      }),
    [estudio.tareas, mes],
  );

  const celdas = useMemo(() => {
    const inicio = (new Date(mes.anio, mes.mes - 1, 1).getDay() + 6) % 7;
    const cantidad = new Date(mes.anio, mes.mes, 0).getDate();
    const dias: Array<{ dia: number; iso: string; tareas: typeof delMes } | null> = [];
    for (let i = 0; i < inicio; i += 1) dias.push(null);
    for (let dia = 1; dia <= cantidad; dia += 1) {
      const iso = `${mes.anio}-${String(mes.mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      dias.push({ dia, iso, tareas: delMes.filter((tarea) => tarea.fecha_entrega === iso) });
    }
    return dias;
  }, [mes, delMes]);

  const titulo = new Date(mes.anio, mes.mes - 1, 1).toLocaleDateString("es", {
    month: "long",
    year: "numeric",
  });

  function moverMes(delta: number) {
    setMes((actual) => {
      const fecha = new Date(actual.anio, actual.mes - 1 + delta, 1);
      return { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1 };
    });
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setOcupado(true);
    setMensaje("");
    try {
      await estudio.guardarCalendario({ ...form, aviso_horas: Number(form.aviso_horas) });
      setMensaje("Calendario guardado.");
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }

  async function accion(fn: () => Promise<{ motivo?: string }>) {
    setOcupado(true);
    setMensaje("");
    try {
      const resultado = await fn();
      setMensaje(resultado.motivo || "Listo.");
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "No se pudo completar.");
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(estudio.feedUrl);
      setMensaje("Enlace copiado.");
    } catch {
      setMensaje(estudio.feedUrl);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="outline" className="h-11 shrink-0 border-zinc-800 px-3" onClick={() => moverMes(-1)}>
          Anterior
        </Button>
        <h2 className="text-center font-heading text-xl font-medium text-white">{titulo}</h2>
        <Button type="button" variant="outline" className="h-11 shrink-0 border-zinc-800 px-3" onClick={() => moverMes(1)}>
          Siguiente
        </Button>
      </div>

      <div className="hidden gap-2 md:grid md:grid-cols-7">
        {DIAS.map((dia) => (
          <p key={dia} className="px-2 text-xs uppercase tracking-wide text-zinc-500">
            {dia}
          </p>
        ))}
        {celdas.map((celda, indice) => (
          <div
            key={celda?.iso ?? `vacio-${indice}`}
            className={`min-h-28 rounded-2xl border p-2 ${
              celda?.iso === hoy ? "border-amber-400/40 bg-amber-400/5" : "border-zinc-800/80 bg-zinc-900/30"
            }`}
          >
            {celda ? (
              <>
                <p className="text-sm text-zinc-400">{celda.dia}</p>
                <div className="mt-1 space-y-1">
                  {celda.tareas.map((tarea) => (
                    <button
                      key={tarea.id}
                      type="button"
                      onClick={() => estudio.onEditar(tarea)}
                      className="block w-full truncate rounded-lg bg-zinc-950 px-2 py-1 text-left text-xs text-zinc-100"
                    >
                      {tarea.titulo}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ))}
      </div>

      <div className="space-y-3 md:hidden">
        {delMes.length === 0 ? (
          <p className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            Este mes no tiene entregas con fecha.
          </p>
        ) : (
          delMes.map((tarea) => (
            <button
              key={tarea.id}
              type="button"
              onClick={() => estudio.onEditar(tarea)}
              className="block w-full rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4 text-left"
            >
              <p className="text-sm text-amber-200/90">{formatearFecha(tarea.fecha_entrega)}</p>
              <p className="mt-1 font-medium text-white">{tarea.titulo}</p>
              <p className="mt-1 text-sm text-zinc-400">
                {tarea.nombre_cliente} · {etiquetaPrioridad(tarea)}
              </p>
            </button>
          ))
        )}
      </div>

      <section className="space-y-4 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Calendario del cliente</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            El equipo puede suscribirse al enlace en Google Calendar, Apple o Outlook. Si el servidor
            tiene un token de Google, NatVisual también crea el evento y el recordatorio en el
            calendario de la marca.
          </p>
        </div>
        {estudio.cuentaId !== "todas" && form ? (
          <form onSubmit={guardar} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["ics", "Enlace de calendario"],
                  ["google", "Google Calendar"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  className={
                    form.proveedor === id
                      ? "h-11 border-amber-400/50 bg-amber-400/15 text-amber-100"
                      : "h-11 border-zinc-800 text-zinc-400"
                  }
                  onClick={() => setForm({ ...form, proveedor: id })}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div>
              <Label htmlFor="nv-correos" className="text-zinc-400">
                Correos del equipo
              </Label>
              <Input
                id="nv-correos"
                className={`${fieldClass} mt-1`}
                value={form.correo_equipo}
                onChange={(event) => setForm({ ...form, correo_equipo: event.target.value })}
                placeholder="ana@estudio.com, luis@estudio.com"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="nv-gcal" className="text-zinc-400">
                  ID del calendario de Google
                </Label>
                <Input
                  id="nv-gcal"
                  className={`${fieldClass} mt-1`}
                  value={form.google_calendar_id}
                  onChange={(event) => setForm({ ...form, google_calendar_id: event.target.value })}
                  placeholder="marca@group.calendar.google.com"
                />
              </div>
              <div>
                <Label htmlFor="nv-horas" className="text-zinc-400">
                  Avisar con (horas)
                </Label>
                <Input
                  id="nv-horas"
                  type="number"
                  min={1}
                  max={168}
                  className={`${fieldClass} mt-1`}
                  value={form.aviso_horas}
                  onChange={(event) => setForm({ ...form, aviso_horas: Number(event.target.value) })}
                />
              </div>
            </div>
            <p className="text-sm text-zinc-500">
              Google en el servidor: {estudio.conexion.google ? "listo" : "falta el token"}. Correo:{" "}
              {estudio.conexion.correo ? "listo" : "falta Resend"}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="submit" className="h-11 bg-amber-500 text-zinc-950 hover:bg-amber-400" disabled={ocupado}>
                Guardar vínculo
              </Button>
              <Button type="button" variant="outline" className="h-11 border-zinc-800" onClick={copiar} disabled={!estudio.feedUrl}>
                Copiar enlace
              </Button>
              <Button type="button" variant="outline" className="h-11 border-zinc-800" disabled={ocupado} onClick={() => accion(estudio.publicarGoogle)}>
                Publicar en Google
              </Button>
              <Button type="button" variant="outline" className="h-11 border-zinc-800" disabled={ocupado} onClick={() => accion(estudio.avisarEquipo)}>
                Avisar entregas próximas
              </Button>
              <Button type="button" variant="outline" className="h-11 border-zinc-800" disabled={ocupado} onClick={() => accion(estudio.rotarFeed)}>
                Nuevo enlace
              </Button>
            </div>
            {estudio.feedUrl ? <p className="break-all text-sm text-zinc-400">{estudio.feedUrl}</p> : null}
            <p className="text-sm leading-relaxed text-zinc-500">
              En Google Calendar: Otros calendarios, luego Desde URL. El enlace tiene que ser público
              (https) para que Google lo lea. En local puedes descargar el mes desde Informe, que
              incluye un archivo de calendario.
            </p>
          </form>
        ) : (
          <p className="rounded-2xl bg-zinc-950/70 px-3 py-3 text-sm text-zinc-300">
            Elige un cliente arriba para conectar su calendario y los correos del equipo.
          </p>
        )}
        {mensaje ? <p className="text-sm text-amber-100">{mensaje}</p> : null}
      </section>

      <section className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4">
        <h2 className="text-base font-semibold text-white">Avisos recientes</h2>
        {estudio.avisos.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Todavía no hay avisos de este cliente.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {estudio.avisos.slice(0, 8).map((aviso) => (
              <li key={aviso.id} className="rounded-2xl bg-zinc-950/70 px-3 py-2 text-sm">
                <p className="text-zinc-100">{aviso.titulo}</p>
                <p className="text-zinc-500">
                  {aviso.canal} · {aviso.estado} · {aviso.detalle}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
