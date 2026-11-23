import { EstudioError } from "@/lib/estudio";
import { run } from "@/lib/http";
import { clavePublica, guardarSuscripcion, haySuscripcion, quitarSuscripcion, type Suscripcion } from "@/lib/push";

export async function GET(request: Request) {
  const endpoint = new URL(request.url).searchParams.get("endpoint") || "";
  return run(async () => ({
    publicKey: await clavePublica(),
    suscrito: endpoint ? await haySuscripcion(endpoint) : false,
  }));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Suscripcion;
  return run(async () => {
    try {
      await guardarSuscripcion(body);
    } catch {
      throw new EstudioError("El teléfono no mandó una suscripción válida.");
    }
    return { ok: true };
  });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  return run(async () => {
    if (body.endpoint) await quitarSuscripcion(body.endpoint);
    return { ok: true };
  });
}
