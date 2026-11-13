"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ETIQUETAS, ESTADOS, PRIORIDAD_CLIENTE, URGENCIA, fieldClass } from "@/lib/etiquetas";
import type { Cuenta, Tarea } from "./tipos";

type Borrador = {
  titulo: string;
  descripcion: string;
  estado: string;
  prioridad_cliente: number;
  urgencia_humana: number;
  prioridad_modo: "cliente" | "humana";
  fecha_entrega: string;
  etiqueta: string;
  cuenta_id: string;
};

const vacio: Borrador = {
  titulo: "",
  descripcion: "",
  estado: "pendiente",
  prioridad_cliente: 2,
  urgencia_humana: 2,
  prioridad_modo: "cliente",
  fecha_entrega: "",
  etiqueta: "",
  cuenta_id: "",
};

function Opciones({
  opciones,
  valor,
  onChange,
}: {
  opciones: { id: number; label: string }[];
  valor: number;
  onChange: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {opciones.map((opcion) => (
        <Button
          key={opcion.id}
          type="button"
          variant="outline"
          className={
            valor === opcion.id
              ? "h-11 border-amber-400/50 bg-amber-400/15 text-amber-100 hover:bg-amber-400/20"
              : "h-11 border-zinc-800 bg-zinc-950 text-zinc-400"
          }
          onClick={() => onChange(opcion.id)}
        >
          {opcion.label}
        </Button>
      ))}
    </div>
  );
}

export function EntregaDialog({
  abierto,
  cuentas,
  cuentaId,
  tarea,
  onClose,
  onSave,
}: {
  abierto: boolean;
  cuentas: Cuenta[];
  cuentaId: string;
  tarea: Tarea | null;
  onClose: () => void;
  onSave: (datos: Record<string, unknown>, id: number | null) => Promise<void>;
}) {
  const [form, setForm] = useState<Borrador>(vacio);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    if (tarea) {
      setForm({
        titulo: tarea.titulo,
        descripcion: tarea.descripcion,
        estado: tarea.estado,
        prioridad_cliente: tarea.prioridad_cliente,
        urgencia_humana: tarea.urgencia_humana,
        prioridad_modo: tarea.prioridad_modo,
        fecha_entrega: tarea.fecha_entrega || "",
        etiqueta: tarea.etiqueta,
        cuenta_id: String(tarea.cuenta_id),
      });
    } else {
      setForm({
        ...vacio,
        cuenta_id: cuentaId !== "todas" ? cuentaId : cuentas[0] ? String(cuentas[0].id) : "",
      });
    }
    setError("");
  }, [abierto, tarea, cuentaId, cuentas]);

  function set<K extends keyof Borrador>(clave: K, valor: Borrador[K]) {
    setForm((actual) => ({ ...actual, [clave]: valor }));
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    setGuardando(true);
    setError("");
    try {
      await onSave(
        {
          ...form,
          cuenta_id: Number(form.cuenta_id),
          fecha_entrega: form.fecha_entrega || null,
          prioridad_cliente: Number(form.prioridad_cliente),
          urgencia_humana: Number(form.urgencia_humana),
        },
        tarea?.id ?? null,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-50 sm:max-w-lg">
        <DialogHeader>
          <p className="text-xs uppercase tracking-widest text-amber-400/80">NatVisual</p>
          <DialogTitle className="text-xl text-white">
            {tarea ? "Editar entrega" : "Nueva entrega"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Qué hay que entregar, para quién y cuándo se da por hecha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-3">
          <div>
            <Label htmlFor="nv-cliente" className="text-zinc-400">
              Cliente
            </Label>
            <Select
              value={form.cuenta_id}
              items={Object.fromEntries(cuentas.map((cuenta) => [String(cuenta.id), cuenta.nombre_cliente]))}
              onValueChange={(valor) => valor && set("cuenta_id", valor)}
            >
              <SelectTrigger id="nv-cliente" className="mt-1 h-11 w-full border-zinc-800 bg-zinc-950 text-zinc-100">
                <SelectValue placeholder="Elige un cliente" />
              </SelectTrigger>
              <SelectContent>
                {cuentas.map((cuenta) => (
                  <SelectItem key={cuenta.id} value={String(cuenta.id)}>
                    {cuenta.nombre_cliente}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="nv-titulo" className="text-zinc-400">
              Qué hay que entregar
            </Label>
            <Input
              id="nv-titulo"
              className={`${fieldClass} mt-1`}
              value={form.titulo}
              onChange={(event) => set("titulo", event.target.value)}
              placeholder="Piezas del feed, pauta, reel…"
              required
            />
          </div>
          <div>
            <Label htmlFor="nv-detalle" className="text-zinc-400">
              Detalle
            </Label>
            <Textarea
              id="nv-detalle"
              className="mt-1 min-h-[88px] border-zinc-800 bg-zinc-950 text-zinc-100"
              value={form.descripcion}
              onChange={(event) => set("descripcion", event.target.value)}
              placeholder="Qué incluye y qué falta para darla por hecha"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="nv-fecha" className="text-zinc-400">
                Fecha de entrega
              </Label>
              <Input
                id="nv-fecha"
                type="date"
                className={`${fieldClass} mt-1`}
                value={form.fecha_entrega}
                onChange={(event) => set("fecha_entrega", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="nv-etiqueta" className="text-zinc-400">
                Etiqueta
              </Label>
              <Input
                id="nv-etiqueta"
                list="nv-etiquetas"
                className={`${fieldClass} mt-1`}
                value={form.etiqueta}
                onChange={(event) => set("etiqueta", event.target.value)}
                placeholder="Diseño, pauta…"
              />
              <datalist id="nv-etiquetas">
                {ETIQUETAS.map((etiqueta) => (
                  <option key={etiqueta} value={etiqueta} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <Label className="text-zinc-400">Estado</Label>
            <Select
              value={form.estado}
              items={Object.fromEntries(ESTADOS.map((estado) => [estado.id, estado.label]))}
              onValueChange={(valor) => valor && set("estado", valor)}
            >
              <SelectTrigger className="mt-1 h-11 w-full border-zinc-800 bg-zinc-950 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((estado) => (
                  <SelectItem key={estado.id} value={estado.id}>
                    {estado.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Qué manda en el tablero</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["cliente", "La marca"],
                  ["humana", "El equipo"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  className={
                    form.prioridad_modo === id
                      ? "h-11 border-amber-400/50 bg-amber-400/15 text-amber-100"
                      : "h-11 border-zinc-800 text-zinc-400"
                  }
                  onClick={() => set("prioridad_modo", id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Prioridad que pidió el cliente</p>
            <Opciones
              opciones={PRIORIDAD_CLIENTE}
              valor={form.prioridad_cliente}
              onChange={(id) => set("prioridad_cliente", id)}
            />
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Urgencia que ve el equipo</p>
            <Opciones
              opciones={URGENCIA}
              valor={form.urgencia_humana}
              onChange={(id) => set("urgencia_humana", id)}
            />
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button
            type="submit"
            className="h-11 w-full bg-amber-500 text-zinc-950 hover:bg-amber-400"
            disabled={guardando || !form.cuenta_id}
          >
            {guardando ? "Guardando…" : "Guardar entrega"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
