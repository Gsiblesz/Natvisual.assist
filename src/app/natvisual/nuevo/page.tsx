import { Suspense } from "react";
import { Nuevo } from "@/components/app/nuevo";

export default function Page() {
  return (
    <Suspense>
      <Nuevo />
    </Suspense>
  );
}
