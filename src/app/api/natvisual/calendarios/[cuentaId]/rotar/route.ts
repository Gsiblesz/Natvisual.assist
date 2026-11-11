import { EstudioError, feedUrl, rotarFeed } from "@/lib/estudio";
import { origen, run } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ cuentaId: string }> },
) {
  const params = await context.params;
  return run(async () => {
    const id = Number(params.cuentaId);
    if (!Number.isInteger(id) || id <= 0) throw new EstudioError("Elige un cliente.");
    const calendario = await rotarFeed(id);
    return {
      calendario,
      feed_url: feedUrl(origen(request), calendario.feed_token),
      motivo: "Enlace nuevo. El anterior deja de funcionar.",
    };
  });
}
