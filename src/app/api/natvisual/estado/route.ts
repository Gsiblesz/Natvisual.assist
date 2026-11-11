import { conexionServidor } from "@/lib/estudio";
import { run } from "@/lib/http";

export async function GET() {
  return run(async () => conexionServidor());
}
