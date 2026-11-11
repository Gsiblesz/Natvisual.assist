"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { interpretar } from "@/lib/voz";
import type { Tarea } from "./tipos";

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
};

function reconocer() {
  const ctor = (
    window as Window & {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    }
  ).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
  return ctor ? new ctor() : null;
}

export function VozBar({
  cuentaId,
  tareas,
  onCrear,
  onMover,
}: {
  cuentaId: string;
  tareas: Tarea[];
  onCrear: (datos: Record<string, unknown>) => Promise<void>;
  onMover: (id: number, estado: string) => Promise<void>;
}) {
  const [escuchando, setEscuchando] = useState(false);
  const [aviso, setAviso] = useState("Di “nueva piezas del feed” o “terminada piezas del feed”.");
  const [dicho, setDicho] = useState("");
  const ocupado = useRef(false);

  function hablar(texto: string) {
    setAviso(texto);
    if (!window.speechSynthesis) return;
    const frase = new SpeechSynthesisUtterance(texto);
    frase.lang = "es-VE";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(frase);
  }

  async function aplicar(frase: string) {
    if (ocupado.current) return;
    const accion = interpretar(frase, tareas);
    if (accion.accion === "vacia" || accion.accion === "no") {
      hablar(accion.aviso);
      return;
    }
    ocupado.current = true;
    try {
      if (accion.accion === "crear") {
        if (!cuentaId || cuentaId === "todas") {
          hablar("Elige el cliente y vuelve a decir la actividad.");
          return;
        }
        await onCrear({
          cuenta_id: Number(cuentaId),
          titulo: accion.titulo,
          estado: "pendiente",
          prioridad_cliente: accion.prioridad_cliente || 2,
          urgencia_humana: accion.urgencia_humana || 2,
          prioridad_modo: accion.prioridad_modo || "cliente",
          fecha_entrega: accion.fecha_entrega,
          descripcion: "",
          etiqueta: "",
          origen: "voz",
        });
      } else {
        await onMover(accion.id, accion.estado);
      }
      hablar(accion.aviso);
    } catch (error) {
      hablar(error instanceof Error ? error.message : "No pude guardar lo que dijiste.");
    } finally {
      ocupado.current = false;
    }
  }

  function dictar() {
    const recognition = reconocer();
    if (!recognition) {
      hablar("Este navegador no puede dictar. Escribe la entrega o abre Chrome.");
      return;
    }
    recognition.lang = "es-VE";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const texto = event.results[0]?.[0]?.transcript || "";
      setDicho(texto);
      void aplicar(texto);
    };
    recognition.onerror = () => {
      setEscuchando(false);
      hablar("No pude oírte. Intenta de nuevo.");
    };
    recognition.onend = () => setEscuchando(false);
    setEscuchando(true);
    recognition.start();
  }

  return (
    <section className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          className={`h-14 rounded-2xl px-5 text-base font-semibold ${
            escuchando ? "bg-red-500 text-white hover:bg-red-400" : "bg-amber-400 text-zinc-950 hover:bg-amber-300"
          }`}
          onClick={dictar}
        >
          {escuchando ? "Escuchando…" : "Hablar"}
        </Button>
        <div className="min-w-0">
          <p className="text-sm text-amber-50">{aviso}</p>
          {dicho ? <p className="mt-1 truncate text-sm text-zinc-300">“{dicho}”</p> : null}
        </div>
      </div>
    </section>
  );
}
