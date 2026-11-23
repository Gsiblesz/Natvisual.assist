"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { useMemo } from "react";
import { cuando, fechaEnCaracas, fechaLarga } from "@/lib/fechas";
import { grupoDe, progreso, siguientePaso, type Grupo } from "@/lib/plan";
import { useApp } from "./estado";
import { Circulo, colorFecha, Pantalla, Seccion, Vacio, botonPrincipal } from "./piezas";
import type { Paso, Tarea } from "./tipos";

type Item = { tarea: Tarea; paso: Paso; fecha: string | null; grupo: Grupo };

const GRUPOS: { id: Grupo; titulo: string; tono: "normal" | "alerta" | "foco" }[] = [
  { id: "atrasado", titulo: "Atrasado", tono: "alerta" },
  { id: "hoy", titulo: "Hoy", tono: "foco" },
  { id: "pronto", titulo: "Esta semana", tono: "normal" },
  { id: "luego", titulo: "Más adelante", tono: "normal" },
  { id: "sin_fecha", titulo: "Sin fecha", tono: "normal" },
];

function FilaPaso({ item }: { item: Item }) {
  const { marcarPaso } = useApp();
  const { hechos, total } = progreso(item.tarea.pasos);
  return (
    <li className="flex items-center gap-1 rounded-3xl border border-zinc-800/80 bg-zinc-900/60 py-2 pr-4 pl-1">
      <Circulo
        hecho={false}
        etiqueta={`Marcar ${item.paso.nombre} de ${item.tarea.titulo} como hecho`}
        onClick={() => void marcarPaso(item.tarea, item.paso.id, true)}
      />
      <Link href={`/natvisual/encargos/${item.tarea.id}`} className="min-w-0 flex-1 py-1">
        <p className="flex items-center gap-1.5 text-[17px] font-medium text-zinc-50">
          <span className="truncate">{item.paso.nombre}</span>
          {item.tarea.urgente ? <Flame className="size-4 shrink-0 text-red-300" aria-label="Urgente" /> : null}
        </p>
        <p className="line-clamp-2 text-sm text-zinc-300">{item.tarea.titulo}</p>
        <p className="mt-0.5 truncate text-[13px] text-zinc-500">
          {item.tarea.nombre_cliente} · paso {hechos + 1} de {total}
          {item.fecha ? <span className={colorFecha(item.fecha)}> · {cuando(item.fecha)}</span> : null}
        </p>
      </Link>
    </li>
  );
}

export function Hoy() {
  const { tareas, cuentas } = useApp();
  const hoy = fechaEnCaracas();

  const items = useMemo(() => {
    const lista: Item[] = [];
    for (const tarea of tareas) {
      if (tarea.estado === "hecho" || tarea.estado_cliente !== "activo") continue;
      const paso = siguientePaso(tarea.pasos);
      if (!paso) continue;
      const fecha = paso.fecha || tarea.fecha_entrega;
      lista.push({ tarea, paso, fecha, grupo: grupoDe(fecha, hoy) });
    }
    return lista.sort(
      (a, b) =>
        (a.fecha || "9999").localeCompare(b.fecha || "9999") ||
        Number(b.tarea.urgente) - Number(a.tarea.urgente) ||
        a.tarea.id - b.tarea.id,
    );
  }, [tareas, hoy]);

  const atrasados = items.filter((item) => item.grupo === "atrasado").length;
  const deHoy = items.filter((item) => item.grupo === "hoy").length;
  const resumen =
    atrasados || deHoy
      ? [deHoy ? `${deHoy} para hoy` : "", atrasados ? `${atrasados} atrasado${atrasados === 1 ? "" : "s"}` : ""]
          .filter(Boolean)
          .join(" · ")
      : items.length
        ? "Nada vence hoy"
        : "";

  const activos = cuentas.filter((cuenta) => cuenta.estado === "activo");

  return (
    <Pantalla titulo="Hoy" sobre={fechaLarga(hoy)}>
      {resumen ? <p className="-mt-3 mb-5 text-[15px] text-zinc-300">{resumen}</p> : null}
      {activos.length === 0 ? (
        <Vacio>
          <p>Empieza por tus clientes.</p>
          <Link href="/natvisual/clientes?nuevo=1" className={`${botonPrincipal} mt-4`}>
            Añadir el primer cliente
          </Link>
        </Vacio>
      ) : items.length === 0 ? (
        <Vacio>
          <p>No hay nada pendiente.</p>
          <p className="mt-1 text-sm text-zinc-500">Toca el + para anotar un encargo nuevo.</p>
        </Vacio>
      ) : (
        GRUPOS.map((grupo) => {
          const delGrupo = items.filter((item) => item.grupo === grupo.id);
          if (!delGrupo.length) return null;
          return (
            <Seccion key={grupo.id} titulo={grupo.titulo} tono={grupo.tono}>
              <ul className="space-y-2">
                {delGrupo.map((item) => (
                  <FilaPaso key={item.paso.id} item={item} />
                ))}
              </ul>
            </Seccion>
          );
        })
      )}
    </Pantalla>
  );
}
