"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldClass } from "@/lib/etiquetas";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    fetch("/api/admin/sesion").then((response) => {
      if (response.ok) router.replace("/natvisual");
      else setListo(true);
    });
  }, [router]);

  async function entrar(event: React.FormEvent) {
    event.preventDefault();
    setEnviando(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo entrar.");
      router.replace("/natvisual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
    } finally {
      setEnviando(false);
    }
  }

  if (!listo) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-400">
        Cargando el estudio…
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 text-zinc-50">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
        <p className="text-xs uppercase tracking-widest text-amber-400/80">Estudio</p>
        <h1 className="mt-1 text-3xl font-semibold text-white">NatVisual</h1>
        <p className="mt-2 text-sm text-zinc-400">Entra para anotar entregas y cerrarlas por voz.</p>
        <Label htmlFor="password" className="mt-6 text-zinc-300">
          Contraseña del estudio
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className={`${fieldClass} mt-2`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        <Button
          type="submit"
          className="mt-5 h-11 w-full bg-amber-500 text-zinc-950 hover:bg-amber-400"
          disabled={enviando}
        >
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
