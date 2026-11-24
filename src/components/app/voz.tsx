"use client";

import { Check, Flame, Keyboard, Mic, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { cuando } from "@/lib/fechas";
import { detectar, pasosConFecha, tipoDe } from "@/lib/plan";
import { useApp } from "./estado";
import { ir } from "./nav";
import type { Tarea } from "./tipos";

type Resultado = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
type Reconocedor = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (event: { resultIndex: number; results: Resultado }) => void;
  onerror: (event: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function crearReconocedor(): Reconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Reconocedor;
    webkitSpeechRecognition?: new () => Reconocedor;
  };
  const Clase = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Clase ? new Clase() : null;
}

function decir(frase: string) {
  if (!window.speechSynthesis) return;
  const voz = new SpeechSynthesisUtterance(frase);
  voz.lang = "es-VE";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(voz);
}

/** Hoja para anotar un encargo hablando. Si el navegador no deja usar el micrófono, se dicta con el teclado. */
export function CapturaVoz({ abierta, cerrar }: { abierta: boolean; cerrar: () => void }) {
  const { cuentas, avisar, reemplazarTarea, recargar } = useApp();
  const [texto, setTexto] = useState("");
  const [parcial, setParcial] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [modoTeclado, setModoTeclado] = useState(false);
  const [cuentaElegida, setCuentaElegida] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const rec = useRef<Reconocedor | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const activos = useMemo(() => cuentas.filter((c) => c.estado === "activo"), [cuentas]);
  const todo = `${texto} ${parcial}`.trim();
  const d = useMemo(() => (todo ? detectar(todo, cuentas) : null), [todo, cuentas]);
  const cuentaId = cuentaElegida ?? d?.cuenta_id ?? (activos.length === 1 ? activos[0].id : null);
  const cliente = cuentas.find((c) => c.id === cuentaId);
  const pasos = d ? pasosConFecha(d.tipo, d.fecha_entrega) : [];

  function escuchar() {
    const r = crearReconocedor();
    if (!r) {
      pasarATeclado();
      return;
    }
    rec.current = r;
    r.lang = "es-VE";
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (event) => {
      let final = "";
      let tmp = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const frase = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) final += frase;
        else tmp += frase;
      }
      if (final) setTexto((prev) => `${prev} ${final}`.trim());
      setParcial(tmp);
    };
    r.onerror = (event) => {
      setEscuchando(false);
      if (event.error === "no-speech" || event.error === "aborted") return;
      // En la app instalada del iPhone Safari a veces no presta el micrófono.
      pasarATeclado();
    };
    r.onend = () => {
      setEscuchando(false);
      setParcial("");
    };
    try {
      r.start();
      setEscuchando(true);
      if (navigator.vibrate) navigator.vibrate(15);
    } catch {
      pasarATeclado();
    }
  }

  function parar() {
    rec.current?.stop();
  }

  function pasarATeclado() {
    setModoTeclado(true);
    setEscuchando(false);
    requestAnimationFrame(() => areaRef.current?.focus());
  }

  // Al abrir, empieza a escuchar solo.
  useEffect(() => {
    if (!abierta) return;
    setTexto("");
    setParcial("");
    setCuentaElegida(null);
    setGuardando(false);
    const puede = crearReconocedor() !== null;
    setModoTeclado(!puede);
    if (puede) escuchar();
    else requestAnimationFrame(() => areaRef.current?.focus());
    return () => rec.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  async function guardar() {
    if (!d || !cuentaId || !d.titulo.trim()) return;
    parar();
    setGuardando(true);
    try {
      const { tarea } = await api<{ tarea: Tarea }>("/api/natvisual/tareas", {
        method: "POST",
        body: JSON.stringify({
          cuenta_id: cuentaId,
          titulo: d.titulo.trim(),
          tipo: d.tipo,
          fecha_entrega: d.fecha_entrega,
          urgente: d.urgente,
          pasos: pasos.map((p) => ({ nombre: p.nombre, fecha: p.fecha })),
        }),
      });
      reemplazarTarea(tarea);
      const frase = `Anotado: ${tarea.titulo} para ${cliente?.nombre_cliente || "el cliente"}. Primero: ${tarea.pasos[0]?.nombre}.`;
      avisar(frase, undefined, true);
      decir(frase);
      cerrar();
      void recargar();
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  function editarCompleto() {
    parar();
    const qs = new URLSearchParams({ texto: todo });
    if (cuentaId) qs.set("para", String(cuentaId));
    cerrar();
    ir(`/natvisual/nuevo?${qs.toString()}`);
  }

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Anotar hablando">
      <button type="button" aria-label="Cerrar" onClick={cerrar} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative mx-auto w-full max-w-md animate-[subir_.22s_ease-out] rounded-t-[32px] border-t border-zinc-800 bg-zinc-900 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-700" />
        <div className="mb-3 flex items-center justify-between">
          <p className="font-heading text-2xl text-white">{escuchando ? "Te escucho…" : "Anotar encargo"}</p>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-zinc-800 text-zinc-300">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {modoTeclado ? (
          <div>
            <textarea
              ref={areaRef}
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Reel para Hotel Mar el viernes, urgente"
              className="w-full resize-none rounded-3xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-[18px] leading-snug text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-amber-400/70"
            />
            <p className="mt-1.5 px-1 text-sm text-zinc-500">
              Toca el <Mic className="inline size-3.5 align-[-2px]" aria-label="micrófono" /> del teclado y dilo como hablas.
            </p>
          </div>
        ) : (
          <div className="flex min-h-[96px] items-center rounded-3xl bg-zinc-950 px-4 py-3.5">
            {todo ? (
              <p className="text-[19px] leading-snug text-zinc-50">
                {texto} <span className="text-zinc-500">{parcial}</span>
              </p>
            ) : (
              <p className="text-[17px] text-zinc-500">Ej.: «Reel para Hotel Mar el viernes, urgente»</p>
            )}
          </div>
        )}

        {d ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 text-[14px]">
              <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-amber-100">{tipoDe(d.tipo).label}</span>
              <span className={`rounded-full px-3 py-1.5 ${cliente ? "bg-zinc-800 text-zinc-100" : "bg-red-500/15 text-red-200"}`}>
                {cliente ? cliente.nombre_cliente : "¿Para qué cliente?"}
              </span>
              <span className="rounded-full bg-zinc-800 px-3 py-1.5 text-zinc-100">
                {d.fecha_entrega ? cuando(d.fecha_entrega) : "Sin fecha"}
              </span>
              {d.urgente ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1.5 text-red-200">
                  <Flame className="size-3.5" aria-hidden /> Urgente
                </span>
              ) : null}
              <span className="rounded-full bg-zinc-800 px-3 py-1.5 text-zinc-400">{pasos.length} pasos</span>
            </div>
            {!cliente && activos.length ? (
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCuentaElegida(c.id)}
                    className="min-h-10 shrink-0 rounded-full border border-zinc-700 px-4 text-[15px] text-zinc-200 active:bg-zinc-800"
                  >
                    {c.nombre_cliente}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={modoTeclado ? () => { setModoTeclado(false); escuchar(); } : pasarATeclado}
            aria-label={modoTeclado ? "Usar el micrófono" : "Escribir"}
            className="grid size-12 place-items-center rounded-full bg-zinc-800 text-zinc-300"
          >
            {modoTeclado ? <Mic className="size-5" aria-hidden /> : <Keyboard className="size-5" aria-hidden />}
          </button>

          {!modoTeclado ? (
            <button
              type="button"
              onClick={escuchando ? parar : escuchar}
              aria-label={escuchando ? "Parar" : "Hablar"}
              className={`relative grid size-20 place-items-center rounded-full text-zinc-950 transition active:scale-95 ${escuchando ? "bg-red-400" : "bg-amber-400"}`}
            >
              {escuchando ? <span className="absolute inset-0 animate-ping rounded-full bg-red-400/40" /> : null}
              {escuchando ? <Square className="relative size-7 fill-current" aria-hidden /> : <Mic className="size-8" strokeWidth={2.4} aria-hidden />}
            </button>
          ) : null}

          <button
            type="button"
            onClick={editarCompleto}
            disabled={!todo}
            className="min-h-12 rounded-full px-3 text-[15px] text-zinc-300 disabled:opacity-30"
          >
            Editar
          </button>
        </div>

        <button
          type="button"
          onClick={() => void guardar()}
          disabled={!d || !cuentaId || guardando}
          className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-[17px] font-semibold text-zinc-950 transition active:scale-[0.98] disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          <Check className="size-5" aria-hidden />
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
