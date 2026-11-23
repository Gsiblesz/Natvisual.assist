import { actualizarEncargo, borrarEncargo, EstudioError, obtenerTarea } from "@/lib/estudio";
import { run } from "@/lib/http";

function idDe(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new EstudioError("Ese encargo no existe.", 404);
  return id;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return run(async () => ({ tarea: await obtenerTarea(idDe(id)) }));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  return run(async () => ({ tarea: await actualizarEncargo(idDe(id), body) }));
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return run(async () => {
    await borrarEncargo(idDe(id));
    return { ok: true };
  });
}
