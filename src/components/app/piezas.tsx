"use client";

import { Enlace as Link } from "./nav";
import { Check, ChevronLeft, Flame } from "lucide-react";
import { useEffect } from "react";
import { progreso, siguientePaso, tipoDe } from "@/lib/plan";
import { cuando, fechaEnCaracas } from "@/lib/fechas";
import type { Tarea } from "./tipos";

export function Pantalla({
  titulo,
  sobre,
  volver,
  accion,
  children,
}: {
  titulo: string;
  sobre?: React.ReactNode;
  volver?: { href: string; label: string };
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+120px)]">
      {volver ? (
        <Link
          href={volver.href}
          className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-[15px] text-amber-300"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {volver.label}
        </Link>
      ) : (
        <div className="h-3" />
      )}
      <header className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {sobre ? <p className="text-sm text-zinc-400 first-letter:uppercase">{sobre}</p> : null}
          <h1 className="font-heading text-[34px] leading-tight font-medium tracking-tight text-white">{titulo}</h1>
        </div>
        {accion}
      </header>
      {children}
    </main>
  );
}

export function Seccion({
  titulo,
  tono = "normal",
  children,
}: {
  titulo: string;
  tono?: "normal" | "alerta" | "foco";
  children: React.ReactNode;
}) {
  const color = tono === "alerta" ? "text-red-300" : tono === "foco" ? "text-amber-200" : "text-zinc-400";
  return (
    <section className="mb-6">
      <h2 className={`mb-2 px-1 text-[13px] font-semibold tracking-wide uppercase ${color}`}>{titulo}</h2>
      {children}
    </section>
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-800 px-5 py-8 text-center text-[15px] leading-relaxed text-zinc-400">
      {children}
    </div>
  );
}

export function Circulo({
  hecho,
  onClick,
  etiqueta,
}: {
  hecho: boolean;
  onClick: () => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      aria-pressed={hecho}
      onClick={onClick}
      className="grid size-12 shrink-0 place-items-center rounded-full active:scale-95"
    >
      <span
        className={`grid size-7 place-items-center rounded-full border-2 transition-colors ${
          hecho ? "border-amber-400 bg-amber-400 text-zinc-950" : "border-zinc-600"
        }`}
      >
        {hecho ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
      </span>
    </button>
  );
}

export function Barra({ hechos, total }: { hechos: number; total: number }) {
  const ancho = total ? Math.round((hechos / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800" aria-hidden>
      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${ancho}%` }} />
    </div>
  );
}

export function colorFecha(fecha: string | null, hoy = fechaEnCaracas()) {
  if (!fecha) return "text-zinc-500";
  if (fecha < hoy) return "text-red-300";
  if (fecha === hoy) return "text-amber-200";
  return "text-zinc-400";
}

export function TarjetaEncargo({ tarea, mostrarCliente = false }: { tarea: Tarea; mostrarCliente?: boolean }) {
  const { hechos, total } = progreso(tarea.pasos);
  const sigue = siguientePaso(tarea.pasos);
  const fecha = sigue?.fecha || tarea.fecha_entrega;
  return (
    <Link
      href={`/natvisual/encargos/${tarea.id}`}
      className="block rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-4 active:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-medium text-zinc-50">{tarea.titulo}</p>
          <p className="mt-0.5 text-sm text-zinc-400">
            {mostrarCliente ? `${tarea.nombre_cliente} · ` : ""}
            {tipoDe(tarea.tipo).label}
            {tarea.fecha_entrega ? ` · entrega ${cuando(tarea.fecha_entrega).toLowerCase()}` : ""}
          </p>
        </div>
        {tarea.urgente ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-200">
            <Flame className="size-3.5" aria-hidden />
            Urgente
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Barra hechos={hechos} total={total} />
        <span className="shrink-0 text-xs text-zinc-500">
          {hechos}/{total}
        </span>
      </div>
      {sigue ? (
        <p className="mt-2 text-sm">
          <span className="text-zinc-500">Sigue: </span>
          <span className="text-zinc-200">{sigue.nombre}</span>
          {fecha ? <span className={colorFecha(fecha)}> · {cuando(fecha)}</span> : null}
        </p>
      ) : (
        <p className="mt-2 text-sm text-emerald-300">Terminado</p>
      )}
    </Link>
  );
}

// Hoja que sube desde abajo, como en iOS.
export function Hoja({
  abierta,
  titulo,
  onCerrar,
  children,
}: {
  abierta: boolean;
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!abierta) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", tecla);
    };
  }, [abierta, onCerrar]);
  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/60 animate-in fade-in"
        onClick={onCerrar}
      />
      <div className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-zinc-800 bg-zinc-900 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)] animate-in slide-in-from-bottom">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-700" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-medium text-white">{titulo}</h2>
          <button type="button" onClick={onCerrar} className="min-h-11 rounded-xl px-3 text-[15px] text-amber-300">
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const botonPrincipal =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 text-base font-semibold text-zinc-950 active:bg-amber-300 disabled:opacity-50";
export const botonSecundario =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-base text-zinc-100 active:bg-zinc-800 disabled:opacity-50";
export const botonPeligro =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-500/15 px-4 text-base font-medium text-red-200 active:bg-red-500/25 disabled:opacity-50";
