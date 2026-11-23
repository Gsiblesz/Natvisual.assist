"use client";

import { Bell, Download, LogOut, Share, SquarePlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, descargarInforme } from "@/lib/api-client";
import { selectClass } from "@/lib/etiquetas";
import { fechaEnCaracas } from "@/lib/fechas";
import { useApp } from "./estado";
import { Hoja, Pantalla, Seccion, botonPeligro, botonPrincipal, botonSecundario } from "./piezas";

type EstadoAvisos = "cargando" | "instalar" | "no_soporta" | "bloqueado" | "apagado" | "activo";

function base64aBytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (letra) => letra.charCodeAt(0));
}

function esIphone() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function instalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function Avisos() {
  const { avisar } = useApp();
  const [estado, setEstado] = useState<EstadoAvisos>("cargando");
  const [ocupado, setOcupado] = useState(false);

  const revisar = useCallback(async () => {
    const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!soporta) {
      setEstado(esIphone() && !instalada() ? "instalar" : "no_soporta");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueado");
      return;
    }
    const registro = await navigator.serviceWorker.ready;
    const sub = await registro.pushManager.getSubscription();
    if (!sub) {
      setEstado("apagado");
      return;
    }
    const datos = await api<{ suscrito: boolean }>(`/api/natvisual/push?endpoint=${encodeURIComponent(sub.endpoint)}`);
    if (!datos.suscrito) {
      await api("/api/natvisual/push", { method: "POST", body: JSON.stringify(sub.toJSON()) });
    }
    setEstado("activo");
  }, []);

  useEffect(() => {
    revisar().catch(() => setEstado("apagado"));
  }, [revisar]);

  async function activar() {
    setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        return;
      }
      const registro = await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>("/api/natvisual/push");
      const sub =
        (await registro.pushManager.getSubscription()) ||
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64aBytes(publicKey),
        }));
      await api("/api/natvisual/push", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      setEstado("activo");
      avisar("Listo. Mañana te llega el primer resumen.");
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudieron activar los avisos.");
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    setOcupado(true);
    try {
      const registro = await navigator.serviceWorker.ready;
      const sub = await registro.pushManager.getSubscription();
      if (sub) {
        await api("/api/natvisual/push", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setEstado("apagado");
      avisar("Avisos apagados en este teléfono.");
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudieron apagar.");
    } finally {
      setOcupado(false);
    }
  }

  async function probar() {
    setOcupado(true);
    try {
      const datos = await api<{ motivo: string }>("/api/natvisual/push/prueba", { method: "POST" });
      avisar(datos.motivo);
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo mandar la prueba.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-300">
          <Bell className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-[17px] font-medium text-zinc-50">Resumen de cada mañana</p>
          <p className="text-sm text-zinc-400">
            Entre 7 y 8 a. m. te llega qué pasos tocan hoy y cuáles se atrasaron.
          </p>
        </div>
      </div>

      {estado === "cargando" ? <p className="text-sm text-zinc-500">Revisando…</p> : null}

      {estado === "instalar" ? (
        <div className="space-y-3 text-[15px] text-zinc-300">
          <p>En el iPhone los avisos solo llegan si la app está en la pantalla de inicio:</p>
          <ol className="space-y-2">
            <li className="flex gap-3">
              <span className="text-zinc-500">1</span>
              <span>
                Abre este enlace en <b>Safari</b>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500">2</span>
              <span className="inline-flex flex-wrap items-center gap-1">
                Toca <Share className="inline size-4 text-amber-300" aria-label="Compartir" /> Compartir.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500">3</span>
              <span className="inline-flex flex-wrap items-center gap-1">
                Elige <SquarePlus className="inline size-4 text-amber-300" aria-hidden /> «Agregar a inicio».
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500">4</span>
              <span>Abre NatVisual desde el ícono y vuelve a esta pantalla.</span>
            </li>
          </ol>
        </div>
      ) : null}

      {estado === "no_soporta" ? (
        <p className="text-[15px] text-zinc-300">
          Este navegador no recibe avisos. En el iPhone necesitas iOS 16.4 o más nuevo y abrir la app desde la pantalla de inicio.
        </p>
      ) : null}

      {estado === "bloqueado" ? (
        <p className="text-[15px] text-zinc-300">
          Los avisos están bloqueados. Actívalos en Ajustes del iPhone, luego Notificaciones, luego NatVisual.
        </p>
      ) : null}

      {estado === "apagado" ? (
        <button type="button" disabled={ocupado} onClick={() => void activar()} className={botonPrincipal}>
          Activar el resumen
        </button>
      ) : null}

      {estado === "activo" ? (
        <div className="space-y-2">
          <p className="mb-2 text-[15px] text-emerald-300">Activado en este teléfono.</p>
          <button type="button" disabled={ocupado} onClick={() => void probar()} className={botonSecundario}>
            Mandar uno de prueba ahora
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void apagar()}
            className="min-h-11 w-full rounded-2xl text-[15px] text-zinc-400"
          >
            Apagar en este teléfono
          </button>
        </div>
      ) : null}
    </div>
  );
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Los últimos 12 meses, escritos en español sin depender del idioma del teléfono.
function ultimosMeses() {
  const [anio, mes] = fechaEnCaracas().split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const total = anio * 12 + (mes - 1) - i;
    const a = Math.floor(total / 12);
    const m = (total % 12) + 1;
    return { valor: `${a}-${String(m).padStart(2, "0")}`, label: `${MESES[m - 1]} ${a}` };
  });
}

function CierreDeMes() {
  const { cuentas, avisar, recargar } = useApp();
  const [mes, setMes] = useState(() => fechaEnCaracas().slice(0, 7));
  const [cliente, setCliente] = useState("todas");
  const [purgar, setPurgar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const cerrarConfirmar = useCallback(() => setConfirmar(false), []);
  const nombre = cuentas.find((cuenta) => String(cuenta.id) === cliente)?.nombre_cliente;

  async function descargar() {
    setConfirmar(false);
    setOcupado(true);
    try {
      const [anio, numero] = mes.split("-").map(Number);
      const { purgadas } = await descargarInforme({ cuentaId: cliente, anio, mes: numero, purgar });
      avisar(purgar ? `ZIP listo. Se borraron ${purgadas} encargos terminados.` : "ZIP listo. No se borró nada.");
      if (purgar) {
        setPurgar(false);
        await recargar();
      }
    } catch (err) {
      avisar(err instanceof Error ? err.message : "No se pudo armar el ZIP.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-4">
      <p className="text-sm text-zinc-400">
        Baja un ZIP con los encargos, sus pasos y el historial del mes, para guardarlo o mandarlo.
      </p>
      <div className="space-y-3">
        <div>
          <label htmlFor="nv-mes" className="text-sm text-zinc-400">
            Mes
          </label>
          <select
            id="nv-mes"
            className={`${selectClass} mt-1 bg-zinc-950`}
            value={mes}
            onChange={(event) => setMes(event.target.value)}
          >
            {ultimosMeses().map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="nv-mes-cliente" className="text-sm text-zinc-400">
            Cliente
          </label>
          <select
            id="nv-mes-cliente"
            className={`${selectClass} mt-1 bg-zinc-950`}
            value={cliente}
            onChange={(event) => {
              setCliente(event.target.value);
              if (event.target.value === "todas") setPurgar(false);
            }}
          >
            <option value="todas">Todos</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.nombre_cliente}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className={`flex items-start gap-3 text-[15px] ${cliente === "todas" ? "text-zinc-600" : "text-zinc-300"}`}>
        <input
          type="checkbox"
          className="mt-1 size-5 accent-amber-400"
          checked={purgar}
          disabled={cliente === "todas"}
          onChange={(event) => setPurgar(event.target.checked)}
        />
        <span>
          Después, borrar los encargos terminados de este cliente y este mes.
          {cliente === "todas" ? " Elige un cliente para usarlo." : ""}
        </span>
      </label>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => (purgar ? setConfirmar(true) : void descargar())}
        className={botonPrincipal}
      >
        <Download className="size-5" aria-hidden />
        {ocupado ? "Armando ZIP…" : "Bajar ZIP del mes"}
      </button>

      <Hoja abierta={confirmar} titulo="¿Borrar terminados?" onCerrar={cerrarConfirmar}>
        <p className="mb-5 text-[16px] text-zinc-200">
          Se baja el ZIP y luego se borran del servidor los encargos terminados de {nombre} en {ultimosMeses().find((item) => item.valor === mes)?.label.toLowerCase()}. El ZIP queda
          como copia.
        </p>
        <button type="button" className={botonPeligro} onClick={() => void descargar()}>
          Bajar y borrar
        </button>
      </Hoja>
    </div>
  );
}

export function Ajustes() {
  const { bloqueado } = useApp();
  return (
    <Pantalla titulo="Ajustes">
      <Seccion titulo="Avisos">
        <Avisos />
      </Seccion>
      <Seccion titulo="Cerrar el mes">
        <CierreDeMes />
      </Seccion>
      {bloqueado ? (
        <Seccion titulo="Cuenta">
          <button
            type="button"
            className={botonSecundario}
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            <LogOut className="size-5" aria-hidden />
            Salir
          </button>
        </Seccion>
      ) : null}
      <p className="px-1 text-center text-xs text-zinc-600">
        Los datos se actualizan solos al abrir la app y cada minuto.
      </p>
    </Pantalla>
  );
}
