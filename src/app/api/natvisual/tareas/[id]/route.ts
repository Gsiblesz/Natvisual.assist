import { actualizarTarea, borrarTarea, EstudioError } from "@/lib/estudio";
import { sincronizarTarea } from "@/lib/integraciones";
import { run } from "@/lib/http";

function idDe(params: { id: string }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new EstudioError("Esa entrega no existe.", 404);
  return id;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const body = await request.json().catch(() => ({}));
  return run(async () => {
    const id = idDe(params);
    const tarea = await actualizarTarea(id, body);
    const calendario = await sincronizarTarea(tarea);
    return { tarea, calendario };
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  return run(async () => {
    await borrarTarea(idDe(params));
    return { ok: true };
  });
}
