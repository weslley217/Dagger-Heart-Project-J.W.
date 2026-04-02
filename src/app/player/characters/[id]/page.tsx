import { notFound } from "next/navigation";

import { CharacterSheet } from "@/components/character-sheet";
import { getCharacterSheet } from "@/data/dashboard";
import { requireSession } from "@/lib/auth";

type CharacterPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CharacterPage({ params }: CharacterPageProps) {
  const session = await requireSession("PLAYER");
  const { id } = await params;
  const character = await getCharacterSheet(id, session.userId);

  if (!character) {
    notFound();
  }

  return <CharacterSheet character={character} />;
}
