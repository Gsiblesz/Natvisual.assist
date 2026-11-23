import { Suspense } from "react";
import { Clientes } from "@/components/app/clientes";

export default function Page() {
  return (
    <Suspense>
      <Clientes />
    </Suspense>
  );
}
