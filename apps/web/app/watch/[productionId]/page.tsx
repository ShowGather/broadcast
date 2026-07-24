import { notFound } from "next/navigation";
import { getProduction } from "@/lib/api";
import { PlayerExperience } from "@/components/player-experience";

interface WatchPageProps {
  params: Promise<{ productionId: string }>;
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { productionId } = await params;

  let production;
  try {
    production = await getProduction(productionId);
  } catch {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <PlayerExperience productionId={productionId} />
    </main>
  );
}
