"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { siguientePaso } from "@/lib/plan";
import type { Cuenta, Tarea } from "./tipos";

// Un solo usuario: basta refrescar cada minuto y al volver a la app (ahorra datos móviles).
const REFRESCO_MS = 60_000;

type Toast = { id: number; texto: string; deshacer?: () => void };

type App = {
  cuentas: Cuenta[];
  tareas: Tarea[];
  listo: boolean;
  error: string;
  sinConexion: boolean;
  bloqueado: boolean;
  recargar: () => Promise<void>;
  avisar: (texto: string, deshacer?: () => void, cruzaPantalla?: boolean) => void;
  marcarPaso: (tarea: Tarea, pasoId: number, hecho: boolean) => Promise<void>;
  reemplazarTarea: (tarea: Tarea) => void;
};

const Contexto = createContext<App | null>(null);

function igual<T>(a: T, b: T) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ProveedorApp({ bloqueado, children }: { bloqueado: boolean; children: React.ReactNode }) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [sinConexion, setSinConexion] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const turno = useRef(0);
  const reloj = useRef<number | undefined>(undefined);
  const cargado = useRef(false);

  const recargar = useCallback(async () => {
    const mio = ++turno.current;
    try {
      const [c, t] = await Promise.all([
        api<{ cuentas: Cuenta[] }>("/api/admin/cuentas"),
        api<{ tareas: Tarea[] }>("/api/natvisual/tareas"),
      ]);
      if (mio !== turno.current) return;
      // Solo cambia si hay datos nuevos, para no mover la pantalla mientras escribe.
      setCuentas((previo) => (igual(previo, c.cuentas) ? previo : c.cuentas));
      setTareas((previo) => (igual(previo, t.tareas) ? previo : t.tareas));
      setError("");
      setSinConexion(false);
    } catch (err) {
      if (mio !== turno.current) return;
      if (!cargado.current) setError(err instanceof Error ? err.message : "No se pudo cargar.");
      setSinConexion(true);
    } finally {
      if (mio === turno.current) {
        cargado.current = true;
        setListo(true);
      }
    }
  }, []);

  useEffect(() => {
    void recargar();
    const tick = () => {
      if (!document.hidden) void recargar();
    };
    const intervalo = window.setInterval(tick, REFRESCO_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [recargar]);

  // El aviso de abajo no sigue a la persona a otra pantalla, salvo el que confirma lo que acaba de guardar.
  const ruta = usePathname();
  const rutaDelAviso = useRef(ruta);
  const sobreviveUnSalto = useRef(false);
  useEffect(() => {
    if (rutaDelAviso.current === ruta) return;
    rutaDelAviso.current = ruta;
    if (sobreviveUnSalto.current) sobreviveUnSalto.current = false;
    else setToast(null);
  }, [ruta]);

  // cruzaPantalla: el aviso confirma algo y la pantalla cambia justo después (guardar, borrar).
  const avisar = useCallback((texto: string, deshacer?: () => void, cruzaPantalla = false) => {
    window.clearTimeout(reloj.current);
    sobreviveUnSalto.current = cruzaPantalla;
    setToast({ id: Date.now(), texto, deshacer });
    reloj.current = window.setTimeout(() => setToast(null), deshacer ? 6000 : 3000);
  }, []);

  const reemplazarTarea = useCallback((tarea: Tarea) => {
    setTareas((lista) => {
      const existe = lista.some((item) => item.id === tarea.id);
      return existe ? lista.map((item) => (item.id === tarea.id ? tarea : item)) : [...lista, tarea];
    });
  }, []);

  const marcarPaso = useCallback(
    async (tarea: Tarea, pasoId: number, hecho: boolean) => {
      const ahora = new Date().toISOString();
      const optimista = {
        ...tarea,
        pasos: tarea.pasos.map((paso) => (paso.id === pasoId ? { ...paso, hecho_en: hecho ? ahora : null } : paso)),
      };
      turno.current += 1; // descarta una recarga que venga en camino con datos viejos
      reemplazarTarea(optimista);
      try {
        const { tarea: real } = await api<{ tarea: Tarea }>(`/api/natvisual/pasos/${pasoId}`, {
          method: "PATCH",
          body: JSON.stringify({ hecho }),
        });
        reemplazarTarea(real);
        if (hecho) {
          const paso = tarea.pasos.find((item) => item.id === pasoId);
          const sigue = siguientePaso(real.pasos);
          const deshacer = () => void marcarPaso(real, pasoId, false);
          avisar(
            sigue ? `${paso?.nombre} listo. Sigue: ${sigue.nombre}.` : `${real.titulo} quedó terminado.`,
            deshacer,
          );
        }
      } catch (err) {
        reemplazarTarea(tarea);
        avisar(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    },
    [avisar, reemplazarTarea],
  );

  return (
    <Contexto.Provider
      value={{ cuentas, tareas, listo, error, sinConexion, bloqueado, recargar, avisar, marcarPaso, reemplazarTarea }}
    >
      {children}
      {toast ? (
        <div
          key={toast.id}
          role="status"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+8px)] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-800/95 px-4 py-3 text-sm text-zinc-50 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-2"
        >
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setToast(null)}>
            {toast.texto}
          </button>
          {toast.deshacer ? (
            <button
              type="button"
              className="min-h-10 shrink-0 rounded-xl px-3 font-semibold text-amber-300"
              onClick={() => {
                toast.deshacer?.();
                setToast(null);
              }}
            >
              Deshacer
            </button>
          ) : null}
        </div>
      ) : null}
    </Contexto.Provider>
  );
}

export function useApp() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("NatVisual fuera de su layout");
  return valor;
}
