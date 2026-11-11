import { conexionServidor, ensureCalendario, EstudioError, feedUrl, guardarCalendario } from "@/lib/estudio";
import { origen, run } from "@/lib/http";

function idDe(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new EstudioError("Elige un cliente.");
  return id;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ cuentaId: string }> },
) {
  const params = await context.params;
  return run(async () => {
    const calendario = await ensureCalendario(idDe(params.cuentaId));
    return {
      calendario,
      feed_url: feedUrl(origen(request), calendario.feed_token),
      ...conexionServidor(),
    };
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ cuentaId: string }> },
) {
  const params = await context.params;
  const body = await request.json().catch(() => ({}));
  return run(async () => {
    const calendario = await guardarCalendario(idDe(params.cuentaId), body);
    return {
      calendario,
      feed_url: feedUrl(origen(request), calendario.feed_token),
      ...conexionServidor(),
    };
  });
}
