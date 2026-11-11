import { EstudioError, historialDe } from "@/lib/estudio";
import { run } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  return run(async () => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new EstudioError("Esa entrega no existe.", 404);
    return { historial: await historialDe(id) };
  });
}
