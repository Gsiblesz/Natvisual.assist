import { crearCuenta, listarCuentas } from "@/lib/estudio";
import { run } from "@/lib/http";

export async function GET() {
  return run(async () => ({ cuentas: await listarCuentas() }));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { nombre_cliente?: string };
  return run(async () => ({ cuenta: await crearCuenta(String(body.nombre_cliente ?? "")) }));
}
