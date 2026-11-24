"use client";

import { usePathname, useRouter } from "next/navigation";
import { Mic, Plus, Settings, Sun, Users } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { ProveedorApp, useApp } from "./estado";
import { Enlace } from "./nav";
import { CapturaVoz } from "./voz";
import { Hoy } from "./hoy";
import { Clientes } from "./clientes";
import { Cliente } from "./cliente";
import { Encargo } from "./encargo";
import { Nuevo } from "./nuevo";
import { Ajustes } from "./ajustes";

const PESTANAS = [
  { href: "/natvisual", label: "Hoy", icono: Sun },
  { href: "/natvisual/clientes", label: "Clientes", icono: Users },
  { href: "/natvisual/nuevo", label: "Nuevo", icono: Plus },
  { href: "/natvisual/ajustes", label: "Ajustes", icono: Settings },
];

function activa(path: string, href: string) {
  if (href === "/natvisual") return path === "/natvisual" || path.startsWith("/natvisual/encargos");
  return path.startsWith(href);
}

function BarraInferior({ hablar }: { hablar: () => void }) {
  const path = usePathname();
  const { sinConexion } = useApp();
  const [hoy, clientes, nuevo, ajustes] = PESTANAS;
  const enlace = (item: (typeof PESTANAS)[number]) => {
    const Icono = item.icono;
    const on = activa(path, item.href);
    return (
      <Enlace
        key={item.href}
        href={item.href}
        aria-current={on ? "page" : undefined}
        className={`flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
          on ? "text-amber-300" : "text-zinc-500 active:text-zinc-300"
        }`}
      >
        <Icono className="size-[22px]" strokeWidth={on ? 2.3 : 1.8} aria-hidden />
        {item.label}
      </Enlace>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))]">
      {sinConexion ? (
        <p className="mx-auto mb-2 w-fit rounded-full bg-red-500/20 px-3 py-1 text-center text-xs text-red-100 backdrop-blur">
          Sin conexión. Vuelvo a intentar solo.
        </p>
      ) : null}
      <div className="relative mx-auto grid max-w-md grid-cols-5 items-center rounded-[28px] border border-zinc-800/80 bg-zinc-900/85 shadow-2xl shadow-black/50 backdrop-blur-xl">
        {enlace(hoy)}
        {enlace(clientes)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={hablar}
            aria-label="Anotar hablando"
            className="grid size-[62px] -translate-y-4 place-items-center rounded-full bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/30 ring-[6px] ring-zinc-950 transition active:scale-90"
          >
            <Mic className="size-7" strokeWidth={2.4} aria-hidden />
          </button>
        </div>
        {enlace(nuevo)}
        {enlace(ajustes)}
      </div>
    </nav>
  );
}

// Elige la pantalla por la ruta del navegador: cambiar de pestaña no espera al servidor.
function PantallaActual({ fallback }: { fallback: React.ReactNode }) {
  const path = usePathname();
  let m: RegExpMatchArray | null;
  if (path === "/natvisual") return <Hoy />;
  if (path === "/natvisual/clientes") return <Clientes />;
  if (path === "/natvisual/ajustes") return <Ajustes />;
  if (path === "/natvisual/nuevo") return <Nuevo key="nuevo" />;
  if ((m = path.match(/^\/natvisual\/clientes\/(\d+)$/))) return <Cliente key={m[1]} id={Number(m[1])} />;
  if ((m = path.match(/^\/natvisual\/encargos\/(\d+)$/))) return <Encargo key={m[1]} id={Number(m[1])} />;
  return <>{fallback}</>;
}

function Contenido({ children }: { children: React.ReactNode }) {
  const { listo, error } = useApp();
  if (!listo) {
    return <p className="grid min-h-dvh place-items-center text-zinc-400">Cargando…</p>;
  }
  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-zinc-200">No pude cargar tus encargos.</p>
          <p className="mt-1 text-sm text-zinc-500">{error}</p>
          <button
            type="button"
            className="mt-4 min-h-11 rounded-xl px-4 text-amber-300"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  return (
    <Suspense>
      <PantallaActual fallback={children} />
    </Suspense>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sesion, setSesion] = useState<{ bloqueado: boolean } | null>(null);
  const [sinRed, setSinRed] = useState(false);
  const [voz, setVoz] = useState(false);

  useEffect(() => {
    let vivo = true;
    let reintento: number | undefined;
    const revisar = () =>
      fetch("/api/admin/sesion")
        .then(async (respuesta) => {
          if (!vivo) return;
          if (respuesta.status === 401) {
            router.replace("/login");
            return;
          }
          if (!respuesta.ok) throw new Error("sin servidor");
          const datos = (await respuesta.json()) as { locked?: boolean };
          setSinRed(false);
          setSesion({ bloqueado: Boolean(datos.locked) });
        })
        .catch(() => {
          // Sin señal o servidor caído: no es falta de clave, se reintenta solo.
          if (!vivo) return;
          setSinRed(true);
          reintento = window.setTimeout(revisar, 5000);
        });
    void revisar();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      vivo = false;
      window.clearTimeout(reintento);
    };
  }, [router]);

  if (!sesion) {
    return (
      <p className="grid min-h-dvh place-items-center px-6 text-center text-zinc-400">
        {sinRed ? "Sin conexión. Vuelvo a intentar en unos segundos…" : "Cargando…"}
      </p>
    );
  }

  return (
    <ProveedorApp bloqueado={sesion.bloqueado}>
      <Contenido>{children}</Contenido>
      <BarraInferior hablar={() => setVoz(true)} />
      <CapturaVoz abierta={voz} cerrar={() => setVoz(false)} />
    </ProveedorApp>
  );
}
