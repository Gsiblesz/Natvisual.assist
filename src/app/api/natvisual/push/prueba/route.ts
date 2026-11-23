import { run } from "@/lib/http";
import { enviarATodos, resumenDeHoy } from "@/lib/push";

export async function POST() {
  return run(async () => {
    const resumen = await resumenDeHoy();
    const resultado = await enviarATodos({ ...resumen, title: `Prueba · ${resumen.title}` });
    return {
      ...resultado,
      motivo: resultado.total === 0
        ? "Ningún teléfono tiene los avisos activados."
        : `Mandé el aviso a ${resultado.enviadas} de ${resultado.total} teléfonos.`,
    };
  });
}
