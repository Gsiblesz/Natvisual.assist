"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Settings, Sun, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ProveedorApp, useApp } from "./estado";

const PESTANAS = [
  { href: "/natvisual", label: "Hoy", icono: Sun },
  { href: "/natvisual/clientes", label: "Clientes", icono: Users },
  { href: "/natvisual/ajustes", label: "Ajustes", icono: Settings },
];

function activa(path: string, href: string) {
  if (href === "/natvisual") return path === "/natvisual" || path.startsWith("/natvisual/encargos");
  return path.startsWith(href);
}

function BarraInferior() {
  const path = usePathname();
  const { sinConexion } = useApp();
  const [hoy, clientes, ajustes] = PESTANAS;
  const enlace = (item: (typeof PESTANAS)[number]) => {
    const Icono = item.icono;
    const on = activa(path, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={on ? "page" : undefined}
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
          on ? "text-amber-300" : "text-zinc-500"
        }`}
      >
        <Icono className="size-6" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
        {item.label}
      </Link>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
      {sinConexion ? (
        <p className="bg-red-500/15 py-1 text-center text-xs text-red-200">Sin conexión. Vuelvo a intentar solo.</p>
      ) : null}
      <div className="mx-auto flex max-w-md items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
        {enlace(hoy)}
        {enlace(clientes)}
        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/natvisual/nuevo"
            aria-label="Nuevo encargo"
            className={`grid size-14 -translate-y-3 place-items-center rounded-full bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 active:scale-95 ${
              path.startsWith("/natvisual/nuevo") ? "ring-4 ring-amber-400/30" : ""
            }`}
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </Link>
        </div>
        {enlace(ajustes)}
      </div>
    </nav>
  );
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
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sesion, setSesion] = useState<{ bloqueado: boolean } | null>(null);
  const [sinRed, setSinRed] = useState(false);

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
      <BarraInferior />
    </ProveedorApp>
  );
}
