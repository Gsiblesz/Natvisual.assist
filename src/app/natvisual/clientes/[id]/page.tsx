import { Cliente } from "@/components/app/cliente";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Cliente id={Number(id)} />;
}
