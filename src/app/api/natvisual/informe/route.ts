import { informeMes } from "@/lib/estudio";
import { cuentaIdDe, run } from "@/lib/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const anio = Number(url.searchParams.get("anio"));
  const mes = Number(url.searchParams.get("mes"));
  return run(async () => informeMes(cuentaIdDe(request), anio, mes));
}
