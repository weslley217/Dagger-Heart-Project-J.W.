import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import {
  resolveCharacterTarget,
  targetCardsTable,
  targetCharacterTable,
  targetLogColumn,
} from "@/lib/character-target";
import { assertDb, db } from "@/lib/db";
import { getCampaignCharacterSheet, getCharacterSheet } from "@/data/dashboard";
import { applyCardEffectToCharacter } from "@/rules/cards/engine";
import type { CardEffect } from "@/types/domain";

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as {
    characterId?: string;
    campaignCharacterId?: string;
    cardId?: string;
    effectIndex?: number;
  };

  if (!body.cardId) {
    return jsonError("Carta é obrigatória.");
  }

  const target = await resolveCharacterTarget(
    {
      characterId: body.characterId,
      campaignCharacterId: body.campaignCharacterId,
    },
    auth.session.role === "PLAYER" ? { playerUserId: auth.session.userId } : undefined,
  );

  if (!target) {
    return jsonError("Personagem não encontrado.", 404);
  }

  const character =
    target.kind === "campaign"
      ? await getCampaignCharacterSheet(target.id)
      : await getCharacterSheet(target.id);

  if (!character) {
    return jsonError("Ficha não encontrada.", 404);
  }

  const card = character.cards.find((item) => item.id === body.cardId);
  if (!card) {
    return jsonError("Carta não vinculada à ficha.", 404);
  }

  const idColumn = target.kind === "campaign" ? "campaign_character_id" : "character_id";
  const link = assertDb(
    await db
      .from(targetCardsTable(target))
      .select("*")
      .eq(idColumn, target.id)
      .eq("card_id", body.cardId)
      .maybeSingle(),
    "Falha ao carregar vínculo da carta.",
  ) as Record<string, unknown> | null;

  if (!link) {
    return jsonError("Vínculo de carta não encontrado.", 404);
  }

  const usesCurrent =
    typeof link.uses_current === "number" ? (link.uses_current as number) : null;
  const usesMax = typeof link.uses_max === "number" ? (link.uses_max as number) : null;

  if (typeof usesCurrent === "number" && usesCurrent <= 0) {
    return jsonError("Sem usos restantes para esta carta.");
  }

  const effect =
    typeof body.effectIndex === "number"
      ? (card.effects[body.effectIndex] as CardEffect | undefined)
      : undefined;

  const activeEffect =
    effect ??
    (card.customHandler
      ? ({ type: "custom_handler", handler: card.customHandler } as CardEffect)
      : undefined);

  if (!activeEffect) {
    return jsonError("Nenhum efeito configurado para esta carta.");
  }

  const applied = applyCardEffectToCharacter(character, activeEffect);

  assertDb(
    await db
      .from(targetCharacterTable(target))
      .update({
        current_hp: applied.currentHp,
        armor_current: applied.armorCurrent,
        threshold1: applied.threshold1,
        threshold2: applied.threshold2,
        conditions: applied.conditions,
        resources: applied.resources,
        is_downed: applied.currentHp >= character.totalHp,
      })
      .eq("id", target.id),
    "Falha ao aplicar efeito da carta.",
  );

  if (typeof usesCurrent === "number" && typeof usesMax === "number") {
    assertDb(
      await db
        .from(targetCardsTable(target))
        .update({
          uses_current: Math.max(usesCurrent - 1, 0),
        })
        .eq("id", String(link.id)),
      "Falha ao consumir uso da carta.",
    );
  }

  assertDb(
    await db.from("effect_logs").insert({
      [targetLogColumn(target)]: target.id,
      card_id: body.cardId,
      action: "apply_card_effect",
      summary: `${card.name}: ${applied.summary}`,
    }),
    "Falha ao registrar aplicação da carta.",
  );

  revalidatePath("/master");
  revalidatePath("/player");
  if (target.kind === "base") {
    revalidatePath(`/player/characters/${target.id}`);
  }

  return NextResponse.json({ ok: true });
}
