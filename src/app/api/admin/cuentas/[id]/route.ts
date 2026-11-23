import { actualizarCuenta, borrarCuenta, EstudioError } from "@/lib/estudio";
import { run } from "@/lib/http";

function idDe(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new EstudioError("Ese cliente no existe.", 404);
  return id;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  return run(async () => ({ cuenta: await actualizarCuenta(idDe(id), body) }));
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return run(async () => {
    await borrarCuenta(idDe(id));
    return { ok: true };
  });
}
