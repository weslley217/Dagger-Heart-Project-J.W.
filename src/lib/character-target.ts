import { assertDb, db } from "@/lib/db";

export type CharacterTargetInput = {
  characterId?: string;
  campaignCharacterId?: string;
};

export type CharacterTarget = {
  kind: "base" | "campaign";
  id: string;
  row: Record<string, unknown>;
};

export async function resolveCharacterTarget(
  input: CharacterTargetInput,
  options?: { playerUserId?: string },
): Promise<CharacterTarget | null> {
  if (input.campaignCharacterId) {
    const row = assertDb(
      await db
        .from("campaign_characters")
        .select("*")
        .eq("id", input.campaignCharacterId)
        .maybeSingle(),
      "Falha ao carregar personagem da campanha.",
    ) as Record<string, unknown> | null;

    if (!row) {
      return null;
    }

    if (options?.playerUserId && String(row.player_id) !== options.playerUserId) {
      return null;
    }

    return {
      kind: "campaign",
      id: String(row.id),
      row,
    };
  }

  if (!input.characterId) {
    return null;
  }

  const row = assertDb(
    await db.from("characters").select("*").eq("id", input.characterId).maybeSingle(),
    "Falha ao carregar personagem base.",
  ) as Record<string, unknown> | null;

  if (!row) {
    return null;
  }

  if (options?.playerUserId && String(row.owner_id) !== options.playerUserId) {
    return null;
  }

  return {
    kind: "base",
    id: String(row.id),
    row,
  };
}

export function targetCharacterTable(target: CharacterTarget) {
  return target.kind === "campaign" ? "campaign_characters" : "characters";
}

export function targetCardsTable(target: CharacterTarget) {
  return target.kind === "campaign" ? "campaign_character_cards" : "character_cards";
}

export function targetLogColumn(target: CharacterTarget) {
  return target.kind === "campaign" ? "campaign_character_id" : "character_id";
}
