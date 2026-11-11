"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { fieldClass } from "@/lib/etiquetas";
import { fechaEnCaracas, sumarDias } from "@/lib/fechas";
import { ProveedorEstudio } from "./contexto";
import { EntregaDialog } from "./entrega-dialog";
import { VozBar } from "./voz-bar";
import type { Aviso, Calendario, Cuenta, Tarea } from "./tipos";

const NAV = [
  { href: "/natvisual", label: "Tablero" },
  { href: "/natvisual/calendario", label: "Agenda" },
  { href: "/natvisual/tareas", label: "Tareas" },
  { href: "/natvisual/informe", label: "Informe" },
];

function activo(path: string, href: string) {
  return href === "/natvisual" ? path === "/natvisual" : path.startsWith(href);
}

export function EstudioShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [listo, setListo] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuentaId, setCuentaId] = useState("todas");
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [calendario, setCalendario] = useState<Calendario | null>(null);
  const [feedUrl, setFeedUrl] = useState("");
  const [conexion, setConexion] = useState({ google: false, correo: false });
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [nota, setNota] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [dialogo, setDialogo] = useState<Tarea | null | "nueva">(null);

  useEffect(() => {
    const guardada = window.localStorage.getItem("natvisual_cuenta");
    if (guardada) setCuentaId(guardada);
    fetch("/api/admin/sesion")
      .then(async (response) => {
        if (!response.ok) {
          router.replace("/login");
          return;
        }
        const data = (await response.json()) as { locked?: boolean };
        setBloqueado(Boolean(data.locked));
        setListo(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function cargar(id = cuentaId) {
    setError("");
    const tareasRes = await api<{ tareas: Tarea[] }>(
      `/api/natvisual/tareas${id !== "todas" ? `?cuenta_id=${id}` : ""}`,
    );
    setTareas(tareasRes.tareas || []);
    if (id && id !== "todas") {
      const [cal, avisosRes] = await Promise.all([
        api<{ calendario: Calendario; feed_url: string; google: boolean; correo: boolean }>(
          `/api/natvisual/calendarios/${id}`,
        ),
        api<{ avisos: Aviso[] }>(`/api/natvisual/avisos?cuenta_id=${id}`),
      ]);
      setCalendario(cal.calendario);
      setFeedUrl(cal.feed_url || "");
      setConexion({ google: !!cal.google, correo: !!cal.correo });
      setAvisos(avisosRes.avisos || []);
    } else {
      setCalendario(null);
      setFeedUrl("");
      const estado = await api<{ google: boolean; correo: boolean }>("/api/natvisual/estado");
      setConexion({ google: !!estado.google, correo: !!estado.correo });
      const avisosRes = await api<{ avisos: Aviso[] }>("/api/natvisual/avisos");
      setAvisos(avisosRes.avisos || []);
    }
  }

  useEffect(() => {
    if (!listo) return;
    let vivo = true;
    setCargando(true);
    window.localStorage.setItem("natvisual_cuenta", cuentaId);
    Promise.all([api<{ cuentas: Cuenta[] }>("/api/admin/cuentas"), cargar(cuentaId)])
      .then(([lista]) => {
        if (vivo) setCuentas(lista.cuentas || []);
      })
      .catch((err: Error) => {
        if (vivo) setError(err.message);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
    // cargar changes identity; cuentaId and listo are the real triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, cuentaId]);

  const horas = calendario?.aviso_horas || 24;
  const proximas = useMemo(() => {
    const hoy = fechaEnCaracas();
    const fin = sumarDias(hoy, Math.max(0, Math.ceil(horas / 24)));
    return tareas.filter(
      (tarea) =>
        tarea.estado !== "hecho" &&
        tarea.fecha_entrega &&
        tarea.fecha_entrega >= hoy &&
        tarea.fecha_entrega <= fin,
    );
  }, [tareas, horas]);

  async function guardarEntrega(datos: Record<string, unknown>, id: number | null) {
    setNota("");
    const respuesta = id
      ? await api<{ calendario?: { ok?: boolean; motivo?: string } }>(`/api/natvisual/tareas/${id}`, {
          method: "PATCH",
          body: JSON.stringify(datos),
        })
      : await api<{ calendario?: { ok?: boolean; motivo?: string } }>("/api/natvisual/tareas", {
          method: "POST",
          body: JSON.stringify(datos),
        });
    const motivo = respuesta.calendario?.motivo;
    if (respuesta.calendario && respuesta.calendario.ok === false && motivo && !motivo.includes("enlace")) {
      setNota(motivo);
    }
    await cargar();
  }

  async function mover(id: number, estado: string) {
    const actual = tareas.find((tarea) => tarea.id === id);
    if (!actual || actual.estado === estado) return;
    setNota("");
    setError("");
    try {
      await api(`/api/natvisual/tareas/${id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo mover.");
    }
  }

  async function eliminar(tarea: Tarea) {
    if (!window.confirm(`¿Borrar “${tarea.titulo}”?`)) return;
    setError("");
    try {
      await api(`/api/natvisual/tareas/${tarea.id}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  async function ejemplo() {
    if (cuentaId === "todas") {
      setError("Elige un cliente para cargar el ejemplo.");
      return;
    }
    setError("");
    try {
      await api("/api/natvisual/demo", {
        method: "POST",
        body: JSON.stringify({ cuenta_id: Number(cuentaId) }),
      });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el ejemplo.");
    }
  }

  async function salir() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (!listo) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-400">
        Cargando el estudio…
      </main>
    );
  }

  return (
    <ProveedorEstudio
      value={{
        cuentas,
        cuentaId,
        tareas,
        calendario,
        feedUrl,
        conexion,
        avisos,
        onEditar: (tarea) => setDialogo(tarea),
        onMover: mover,
        eliminar,
        guardarCalendario: async (input) => {
          const data = await api<{ calendario: Calendario; feed_url: string }>(
            `/api/natvisual/calendarios/${cuentaId}`,
            { method: "PUT", body: JSON.stringify(input) },
          );
          setCalendario(data.calendario);
          setFeedUrl(data.feed_url || "");
        },
        publicarGoogle: () => api(`/api/natvisual/calendarios/${cuentaId}/publicar`, { method: "POST" }),
        avisarEquipo: async () => {
          const data = await api<{ motivo?: string }>(`/api/natvisual/calendarios/${cuentaId}/avisar`, {
            method: "POST",
          });
          await cargar();
          return data;
        },
        rotarFeed: async () => {
          const data = await api<{ feed_url?: string; motivo?: string }>(
            `/api/natvisual/calendarios/${cuentaId}/rotar`,
            { method: "POST" },
          );
          setFeedUrl(data.feed_url || "");
          return data;
        },
      }}
    >
      <div className="min-h-screen bg-zinc-950 text-zinc-50">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(251,191,36,0.08),transparent)]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 pb-28 sm:px-6 lg:pb-10">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">NatVisual</h1>
              <p className="text-sm text-zinc-400">Pendientes por voz. Al cumplirlas, pasan a terminadas.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="nv-cuenta-global">
                Cliente
              </label>
              <select
                id="nv-cuenta-global"
                className={`${fieldClass} sm:w-64`}
                value={cuentaId}
                onChange={(event) => setCuentaId(event.target.value)}
              >
                <option value="todas">Todos los clientes</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>
                    {cuenta.nombre_cliente}
                  </option>
                ))}
              </select>
              <form
                className="flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!nuevoNombre.trim()) return;
                  try {
                    const data = await api<{ cuenta: Cuenta }>("/api/admin/cuentas", {
                      method: "POST",
                      body: JSON.stringify({ nombre_cliente: nuevoNombre.trim() }),
                    });
                    setNuevoNombre("");
                    setCuentaId(String(data.cuenta.id));
                    const lista = await api<{ cuentas: Cuenta[] }>("/api/admin/cuentas");
                    setCuentas(lista.cuentas || []);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "No se pudo crear el cliente.");
                  }
                }}
              >
                <Input
                  className={`${fieldClass} sm:w-48`}
                  value={nuevoNombre}
                  onChange={(event) => setNuevoNombre(event.target.value)}
                  placeholder="Nuevo cliente"
                  aria-label="Nuevo cliente"
                />
                <Button type="submit" variant="outline" className="h-11 border-zinc-800">
                  Añadir
                </Button>
              </form>
              <Button
                type="button"
                className="h-11 bg-amber-500 text-zinc-950 hover:bg-amber-400"
                onClick={() => setDialogo("nueva")}
              >
                Nueva entrega
              </Button>
              {bloqueado ? (
                <Button type="button" variant="ghost" className="h-11 text-zinc-400" onClick={salir}>
                  Salir
                </Button>
              ) : null}
            </div>
          </header>

          <VozBar cuentaId={cuentaId} tareas={tareas} onCrear={(datos) => guardarEntrega(datos, null)} onMover={mover} />

          <nav className="hidden gap-2 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center rounded-xl px-4 text-sm font-medium ${
                  activo(path, item.href)
                    ? "bg-amber-400/15 text-amber-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {proximas.length > 0 ? (
            <Link
              href="/natvisual/calendario"
              className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50"
            >
              {proximas.length === 1
                ? `1 entrega en las próximas ${horas} h: ${proximas[0].titulo}`
                : `${proximas.length} entregas en las próximas ${horas} h. Ábrelas en la agenda.`}
            </Link>
          ) : null}
          {nota ? <p className="text-sm text-amber-100">{nota}</p> : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {cargando ? <p className="text-sm text-zinc-500">Cargando entregas…</p> : null}
          {!cargando && tareas.length === 0 && !error ? (
            <div className="flex flex-col gap-3 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-300">
                Este tablero está vacío. Carga un mes de ejemplo o crea la primera entrega.
              </p>
              <Button type="button" variant="outline" className="border-zinc-800" onClick={ejemplo}>
                Cargar ejemplo
              </Button>
            </div>
          ) : null}
          {children}
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg pb-[env(safe-area-inset-bottom)]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[52px] flex-1 items-center justify-center text-sm font-medium ${
                  activo(path, item.href) ? "text-amber-200" : "text-zinc-500"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <EntregaDialog
          abierto={dialogo !== null}
          cuentas={cuentas}
          cuentaId={cuentaId}
          tarea={dialogo && dialogo !== "nueva" ? dialogo : null}
          onClose={() => setDialogo(null)}
          onSave={guardarEntrega}
        />
      </div>
    </ProveedorEstudio>
  );
}
