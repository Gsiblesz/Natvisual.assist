import { actualizarPaso, borrarPaso, EstudioError } from "@/lib/estudio";
import { run } from "@/lib/http";

function idDe(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new EstudioError("Ese paso no existe.", 404);
  return id;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  return run(async () => ({ tarea: await actualizarPaso(idDe(id), body) }));
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return run(async () => ({ tarea: await borrarPaso(idDe(id)) }));
}
