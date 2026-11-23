import { agregarPaso, EstudioError } from "@/lib/estudio";
import { run } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  return run(async () => {
    const tareaId = Number(id);
    if (!Number.isInteger(tareaId) || tareaId <= 0) throw new EstudioError("Ese encargo no existe.", 404);
    return { tarea: await agregarPaso(tareaId, body) };
  });
}
