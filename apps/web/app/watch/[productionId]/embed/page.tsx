import { PlayerExperience } from "@/components/player-experience";

interface EmbedPageProps {
  params: Promise<{ productionId: string }>;
  searchParams: Promise<{ profile?: string; mode?: string }>;
}

export default async function EmbedPage({ params, searchParams }: EmbedPageProps) {
  const { productionId } = await params;
  const { profile = "desktop", mode } = await searchParams;
  const rehearsal = mode === "rehearsal";

  return (
    <main>
      <PlayerExperience
        productionId={productionId}
        profile={profile as "desktop" | "mobile" | "tv"}
        embedded={true}
        rehearsal={rehearsal}
      />
    </main>
  );
}
