"use client";

import { Flame, Mic, Plus, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useIr } from "./nav";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { fieldClass, selectClass } from "@/lib/etiquetas";
import { cuando, fechaEnCaracas, sumarDias } from "@/lib/fechas";
import { detectar, pasosConFecha, TIPOS } from "@/lib/plan";
import { useApp } from "./estado";
import { Pantalla, botonPrincipal } from "./piezas";
import type { Cuenta, Tarea } from "./tipos";

type PasoBorrador = { clave: number; nombre: string; fecha: string };

type Reconocedor = {
  lang: string;
  interimResults: boolean;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
};

function reconocedor(): Reconocedor | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => Reconocedor;
    webkitSpeechRecognition?: new () => Reconocedor;
  };
  const Clase = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Clase ? new Clase() : null;
}

// Atajos para el pulgar: no dependen del idioma del selector de fecha del teléfono.
function atajosDeFecha() {
  const hoy = fechaEnCaracas();
  const [y, m, d] = hoy.split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const proximo = (objetivo: number) => sumarDias(hoy, ((objetivo - dia + 7) % 7) || 7);
  return [
    { label: "Hoy", fecha: hoy },
    { label: "Mañana", fecha: sumarDias(hoy, 1) },
    { label: "Viernes", fecha: proximo(5) },
    { label: "Lunes", fecha: proximo(1) },
    { label: "En una semana", fecha: sumarDias(hoy, 7) },
  ];
}

let contador = 0;
function conClave(pasos: { nombre: string; fecha: string | null }[]): PasoBorrador[] {
  return pasos.map((paso) => ({ clave: ++contador, nombre: paso.nombre, fecha: paso.fecha || "" }));
}

export function Nuevo() {
  const { cuentas, recargar, avisar, reemplazarTarea } = useApp();
  const router = useIr();
  const params = useSearchParams();
  const desdeCliente = Number(params.get("cliente")) || null;
  // Desde la voz: el texto dictado y el cliente que ya se reconoció.
  const dictado = params.get("texto") || "";
  const para = Number(params.get("para")) || null;

  const elegibles = useMemo(
    () =>
      [...cuentas]
        .filter((cuenta) => cuenta.estado !== "archivado" || cuenta.id === desdeCliente)
        .sort((a, b) => Number(a.estado !== "activo") - Number(b.estado !== "activo")),
    [cuentas, desdeCliente],
  );

  const [texto, setTexto] = useState(dictado);
  const [cuentaId, setCuentaId] = useState<number | null>(desdeCliente ?? para);
  const [tipo, setTipo] = useState("otro");
  const [fecha, setFecha] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [pasos, setPasos] = useState<PasoBorrador[]>(() => conClave(pasosConFecha("otro", null)));
  const [tocado, setTocado] = useState({ cliente: Boolean(desdeCliente ?? para), tipo: false, fecha: false, urgente: false, titulo: false, pasos: false });
  const [nuevoPaso, setNuevoPaso] = useState("");
  const [nuevoCliente, setNuevoCliente] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [puedeDictar, setPuedeDictar] = useState(false);
  const porVoz = useRef(false);
  const filaTipos = useRef<HTMLDivElement>(null);

  // El tipo detectado queda a la vista aunque esté al final de la fila.
  useEffect(() => {
    filaTipos.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [tipo]);

  useEffect(() => {
    setPuedeDictar(reconocedor() !== null);
  }, []);

  // Si solo hay un cliente activo, ya queda elegido.
  useEffect(() => {
    if (cuentaId === null && !tocado.cliente) {
      const activos = cuentas.filter((cuenta) => cuenta.estado === "activo");
      if (activos.length === 1) setCuentaId(activos[0].id);
    }
  }, [cuentas, cuentaId, tocado.cliente]);

  // Lo que escribe llena los campos que no ha tocado a mano.
  useEffect(() => {
    if (!texto.trim()) return;
    const d = detectar(texto, elegibles);
    if (!tocado.titulo) setTitulo(d.titulo);
    if (!tocado.tipo) setTipo(d.tipo);
    if (!tocado.fecha) setFecha(d.fecha_entrega || "");
    if (!tocado.urgente) setUrgente(d.urgente);
    if (!tocado.cliente && d.cuenta_id) setCuentaId(d.cuenta_id);
  }, [texto, elegibles, tocado.titulo, tocado.tipo, tocado.fecha, tocado.urgente, tocado.cliente]);

  // Los pasos se rehacen con el tipo y la fecha, salvo que ya los haya editado.
  useEffect(() => {
    if (!tocado.pasos) setPasos(conClave(pasosConFecha(tipo, fecha || null)));
  }, [tipo, fecha, tocado.pasos]);

  function hablar(frase: string) {
    if (!porVoz.current || !window.speechSynthesis) return;
    const voz = new SpeechSynthesisUtterance(frase);
    voz.lang = "es-VE";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(voz);
  }

  function dictar() {
    const rec = reconocedor();
    if (!rec) return;
    rec.lang = "es-VE";
    rec.interimResults = false;
    rec.onresult = (event) => {
      const dicho = event.results[0]?.[0]?.transcript || "";
      porVoz.current = true;
      setTexto((previo) => (previo ? `${previo} ${dicho}` : dicho));
    };
    rec.onerror = () => {
      setEscuchando(false);
      avisar("No pude oírte. Usa el micrófono del teclado.");
    };
    rec.onend = () => setEscuchando(false);
    setEscuchando(true);
    try {
      rec.start();
    } catch {
      setEscuchando(false);
    }
  }

  async function crearCliente() {
    if (!nuevoCliente.trim()) return;
    try {
      const { cuenta } = await api<{ cuenta: Cuenta }>("/api/admin/cuentas", {
        method: "POST",
        body: JSON.stringify({ nombre_cliente: nuevoCliente.trim() }),
      });
      await recargar();
      setCuentaId(cuenta.id);
      setTocado((t) => ({ ...t, cliente: true }));
      setNuevoCliente("");
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo crear el cliente.");
    }
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!cuentaId) {
      avisar("Elige el cliente.");
      return;
    }
    const limpios = pasos.filter((paso) => paso.nombre.trim());
    if (!titulo.trim() || !limpios.length) return;
    setGuardando(true);
    try {
      const { tarea } = await api<{ tarea: Tarea }>("/api/natvisual/tareas", {
        method: "POST",
        body: JSON.stringify({
          cuenta_id: cuentaId,
          titulo: titulo.trim(),
          tipo,
          fecha_entrega: fecha || null,
          urgente,
          pasos: limpios.map((paso) => ({ nombre: paso.nombre.trim(), fecha: paso.fecha || null })),
        }),
      });
      reemplazarTarea(tarea);
      const frase = `Anotado: ${tarea.titulo}, ${tarea.pasos.length} pasos. Primero: ${tarea.pasos[0]?.nombre}.`;
      avisar(frase, undefined, true);
      hablar(frase);
      router.push(desdeCliente ? `/natvisual/clientes/${desdeCliente}` : "/natvisual");
      void recargar();
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  const listo = Boolean(cuentaId && titulo.trim() && pasos.some((paso) => paso.nombre.trim()));

  return (
    <Pantalla
      titulo="Nuevo encargo"
      volver={desdeCliente ? { href: `/natvisual/clientes/${desdeCliente}`, label: "Cliente" } : undefined}
    >
      <form onSubmit={guardar} className="space-y-6">
        <div>
          <label htmlFor="nv-texto" className="mb-2 block text-[15px] text-zinc-300">
            ¿Qué te pidieron?
          </label>
          <div className="relative">
            <textarea
              id="nv-texto"
              autoFocus={!dictado}
              rows={3}
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Reel de habitaciones para Hotel Mar el viernes"
              className="w-full resize-none rounded-3xl border border-zinc-800 bg-zinc-900 px-4 py-4 pr-16 text-[18px] leading-snug text-zinc-50 outline-none placeholder:text-zinc-600 focus-visible:border-amber-400/70"
            />
            {puedeDictar ? (
              <button
                type="button"
                onClick={dictar}
                aria-label={escuchando ? "Escuchando" : "Dictar"}
                className={`absolute right-3 bottom-4 grid size-11 place-items-center rounded-full ${
                  escuchando ? "animate-pulse bg-red-500 text-white" : "bg-zinc-800 text-amber-300"
                }`}
              >
                <Mic className="size-5" aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="mt-2 px-1 text-sm text-zinc-500">
            Escribe o dicta como hablas: el tipo, el cliente y la fecha. Los pasos salen solos.
          </p>
        </div>

        <div className="space-y-4 rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-4">
          <div>
            <label htmlFor="nv-titulo" className="text-sm text-zinc-400">
              Encargo
            </label>
            <input
              id="nv-titulo"
              className={`${fieldClass} mt-1 bg-zinc-950`}
              value={titulo}
              onChange={(event) => {
                setTitulo(event.target.value);
                setTocado((t) => ({ ...t, titulo: true }));
              }}
              placeholder="Reel de habitaciones"
            />
          </div>

          <div>
            <label htmlFor="nv-cliente" className="text-sm text-zinc-400">
              Cliente
            </label>
            {elegibles.length ? (
              <select
                id="nv-cliente"
                className={`${selectClass} mt-1 bg-zinc-950`}
                value={cuentaId ?? ""}
                onChange={(event) => {
                  setCuentaId(Number(event.target.value) || null);
                  setTocado((t) => ({ ...t, cliente: true }));
                }}
              >
                <option value="">Elige el cliente</option>
                {elegibles.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.nombre_cliente}
                    {cuenta.estado !== "activo" ? ` (${cuenta.estado})` : ""}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="mt-2 flex gap-2">
              <input
                className={`${fieldClass} bg-zinc-950`}
                value={nuevoCliente}
                onChange={(event) => setNuevoCliente(event.target.value)}
                placeholder={elegibles.length ? "O añade uno nuevo" : "Nombre del primer cliente"}
                aria-label="Cliente nuevo"
                autoCapitalize="words"
              />
              <button
                type="button"
                onClick={() => void crearCliente()}
                disabled={!nuevoCliente.trim()}
                className="min-h-12 shrink-0 rounded-2xl bg-zinc-800 px-4 text-zinc-100 disabled:opacity-40"
              >
                Añadir
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm text-zinc-400">Tipo</p>
            <div ref={filaTipos} className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TIPOS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={tipo === item.id}
                  onClick={() => {
                    setTipo(item.id);
                    setTocado((t) => ({ ...t, tipo: true, pasos: false }));
                  }}
                  className={`min-h-10 shrink-0 rounded-full border px-4 text-[15px] ${
                    tipo === item.id
                      ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <label htmlFor="nv-fecha" className="text-sm text-zinc-400">
              Entrega {fecha ? <span className="text-zinc-500">· {cuando(fecha).toLowerCase()}</span> : null}
            </label>
            <input
              id="nv-fecha"
              type="date"
              className={`${fieldClass} mt-1 block w-full min-w-0 appearance-none bg-zinc-950`}
              value={fecha}
              onChange={(event) => {
                setFecha(event.target.value);
                setTocado((t) => ({ ...t, fecha: true, pasos: false }));
              }}
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {atajosDeFecha().map((atajo) => (
              <button
                key={atajo.label}
                type="button"
                aria-pressed={fecha === atajo.fecha}
                onClick={() => {
                  setFecha(atajo.fecha);
                  setTocado((t) => ({ ...t, fecha: true, pasos: false }));
                }}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-[15px] ${
                  fecha === atajo.fecha
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-100"
                    : "border-zinc-800 bg-zinc-950 text-zinc-400"
                }`}
              >
                {atajo.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={urgente}
            onClick={() => {
              setUrgente(!urgente);
              setTocado((t) => ({ ...t, urgente: true }));
            }}
            className={`flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-[16px] transition-colors ${
              urgente ? "border-red-400/40 bg-red-500/10 text-red-100" : "border-zinc-800 bg-zinc-950 text-zinc-300"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Flame className={`size-5 ${urgente ? "text-red-300" : "text-zinc-500"}`} aria-hidden />
              Urgente
            </span>
            <span className={`relative h-7 w-12 rounded-full transition-colors ${urgente ? "bg-red-400" : "bg-zinc-700"}`}>
              <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${urgente ? "left-6" : "left-1"}`} />
            </span>
          </button>
        </div>

        <div>
          <p className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-zinc-400 uppercase">
            Pasos ({pasos.length})
          </p>
          <ol className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/60">
            {pasos.map((paso, indice) => (
              <li
                key={paso.clave}
                className={`flex items-center gap-2 px-3 py-2 ${indice ? "border-t border-zinc-800/80" : ""}`}
              >
                <span className="w-5 shrink-0 text-center text-sm text-zinc-600">{indice + 1}</span>
                <input
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-zinc-100 outline-none"
                  value={paso.nombre}
                  aria-label={`Paso ${indice + 1}`}
                  onChange={(event) => {
                    const valor = event.target.value;
                    setPasos((lista) => lista.map((item) => (item.clave === paso.clave ? { ...item, nombre: valor } : item)));
                    setTocado((t) => ({ ...t, pasos: true }));
                  }}
                />
                <span className="shrink-0 text-sm text-zinc-500">{paso.fecha ? cuando(paso.fecha) : ""}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${paso.nombre}`}
                  disabled={pasos.length <= 1}
                  onClick={() => {
                    setPasos((lista) => lista.filter((item) => item.clave !== paso.clave));
                    setTocado((t) => ({ ...t, pasos: true }));
                  }}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-zinc-500 disabled:opacity-30"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex gap-2">
            <input
              className={fieldClass}
              value={nuevoPaso}
              onChange={(event) => setNuevoPaso(event.target.value)}
              placeholder="Añadir otro paso"
              aria-label="Paso nuevo"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (nuevoPaso.trim()) {
                    setPasos((lista) => [...lista, ...conClave([{ nombre: nuevoPaso.trim(), fecha: fecha || null }])]);
                    setTocado((t) => ({ ...t, pasos: true }));
                    setNuevoPaso("");
                  }
                }
              }}
            />
            <button
              type="button"
              aria-label="Añadir paso"
              disabled={!nuevoPaso.trim()}
              onClick={() => {
                setPasos((lista) => [...lista, ...conClave([{ nombre: nuevoPaso.trim(), fecha: fecha || null }])]);
                setTocado((t) => ({ ...t, pasos: true }));
                setNuevoPaso("");
              }}
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-zinc-800 text-amber-300 disabled:opacity-40"
            >
              <Plus className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Guardar siempre a mano, sin bajar hasta el final. */}
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+100px)] z-30 -mx-4 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-4 pt-4 pb-2">
          <button type="submit" disabled={!listo || guardando} className={botonPrincipal}>
            {guardando ? "Guardando…" : "Guardar encargo"}
          </button>
          {!cuentaId ? <p className="mt-1 text-center text-sm text-zinc-500">Falta elegir el cliente.</p> : null}
        </div>
      </form>
    </Pantalla>
  );
}
