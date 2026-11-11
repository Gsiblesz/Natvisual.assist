import { EstudioError } from "@/lib/estudio";
import { run } from "@/lib/http";
import { publicarEnGoogle } from "@/lib/integraciones";

export async function POST(
  _request: Request,
  context: { params: Promise<{ cuentaId: string }> },
) {
  const params = await context.params;
  return run(async () => {
    const id = Number(params.cuentaId);
    if (!Number.isInteger(id) || id <= 0) throw new EstudioError("Elige un cliente.");
    return publicarEnGoogle(id);
  });
}
