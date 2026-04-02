import { notFound } from "next/navigation";

import { CharacterSheet } from "@/components/character-sheet";
import { getCampaignCharacterSheet } from "@/data/dashboard";
import { requireSession } from "@/lib/auth";

type CampaignCharacterPageProps = {
  params: Promise<{ campaignId: string; id: string }>;
};

export default async function CampaignCharacterPage({ params }: CampaignCharacterPageProps) {
  const session = await requireSession("PLAYER");
  const { campaignId, id } = await params;

  const character = await getCampaignCharacterSheet(id, {
    playerId: session.userId,
    campaignId,
  });

  if (!character) {
    notFound();
  }

  return <CharacterSheet character={character} campaignCharacterId={id} />;
}
