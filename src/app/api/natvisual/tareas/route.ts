import { crearTarea, listarTareas } from "@/lib/estudio";
import { sincronizarTarea } from "@/lib/integraciones";
import { cuentaIdDe, run } from "@/lib/http";

export async function GET(request: Request) {
  return run(async () => ({ tareas: await listarTareas(cuentaIdDe(request)) }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return run(async () => {
    const tarea = await crearTarea(body);
    const calendario = await sincronizarTarea(tarea);
    return { tarea, calendario };
  });
}
