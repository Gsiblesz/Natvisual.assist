import { crearEncargo, listarTareas } from "@/lib/estudio";
import { cuentaIdDe, run } from "@/lib/http";

export async function GET(request: Request) {
  return run(async () => ({ tareas: await listarTareas(cuentaIdDe(request)) }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return run(async () => ({ tarea: await crearEncargo(body) }));
}
