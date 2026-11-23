import { Encargo } from "@/components/app/encargo";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Encargo id={Number(id)} />;
}
