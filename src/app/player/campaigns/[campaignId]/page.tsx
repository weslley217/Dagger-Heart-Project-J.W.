import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getCampaignCharactersForPlayer } from "@/data/dashboard";
import { requireSession } from "@/lib/auth";

type CampaignPageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function CampaignPage({ params }: CampaignPageProps) {
  const session = await requireSession("PLAYER");
  const { campaignId } = await params;

  const workspace = await getCampaignCharactersForPlayer(campaignId, session.userId);
  if (!workspace) {
    notFound();
  }

  return (
    <AppShell
      role="PLAYER"
      title={workspace.campaign.name}
      subtitle="Escolha qual snapshot de personagem deseja abrir nesta campanha."
    >
      <section className="grid gap-4 lg:grid-cols-2">
        {workspace.characters.length ? (
          workspace.characters.map((character) => (
            <SurfaceCard key={character.campaignCharacterId} className="space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                Nível {character.level}
              </p>
              <h2 className="text-2xl font-semibold text-white">{character.name}</h2>
              <p className="text-sm text-white/60">{character.shortDescription}</p>
              <Link
                href={`/player/campaigns/${campaignId}/characters/${character.campaignCharacterId}`}
              >
                <Button>Abrir ficha da campanha</Button>
              </Link>
            </SurfaceCard>
          ))
        ) : (
          <SurfaceCard>
            <p className="text-sm text-white/60">
              Nenhum personagem foi preparado para esta campanha ainda.
            </p>
          </SurfaceCard>
        )}
      </section>
    </AppShell>
  );
}
