"use client";

import { createContext, useContext } from "react";
import type { Aviso, Calendario, Cuenta, Tarea } from "./tipos";

export type EstudioContext = {
  cuentas: Cuenta[];
  cuentaId: string;
  tareas: Tarea[];
  calendario: Calendario | null;
  feedUrl: string;
  conexion: { google: boolean; correo: boolean };
  avisos: Aviso[];
  onEditar: (tarea: Tarea) => void;
  onMover: (id: number, estado: string) => Promise<void>;
  eliminar: (tarea: Tarea) => Promise<void>;
  guardarCalendario: (input: Calendario) => Promise<void>;
  publicarGoogle: () => Promise<{ motivo?: string }>;
  avisarEquipo: () => Promise<{ motivo?: string }>;
  rotarFeed: () => Promise<{ motivo?: string }>;
};

const Contexto = createContext<EstudioContext | null>(null);

export function ProveedorEstudio({
  value,
  children,
}: {
  value: EstudioContext;
  children: React.ReactNode;
}) {
  return <Contexto.Provider value={value}>{children}</Contexto.Provider>;
}

export function useEstudio() {
  const value = useContext(Contexto);
  if (!value) throw new Error("NatVisual fuera de su layout");
  return value;
}
