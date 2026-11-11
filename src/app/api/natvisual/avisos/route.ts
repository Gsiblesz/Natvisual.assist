import { listarAvisos } from "@/lib/estudio";
import { cuentaIdDe, run } from "@/lib/http";

export async function GET(request: Request) {
  return run(async () => ({ avisos: await listarAvisos(cuentaIdDe(request)) }));
}
