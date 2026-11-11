import { EstudioError, cargarEjemplo } from "@/lib/estudio";
import { run } from "@/lib/http";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { cuenta_id?: number };
  return run(async () => {
    const id = Number(body.cuenta_id);
    if (!Number.isInteger(id) || id <= 0) throw new EstudioError("Elige un cliente para cargar el ejemplo.");
    return { tareas: await cargarEjemplo(id) };
  });
}
