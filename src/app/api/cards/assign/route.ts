import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import {
  resolveCharacterTarget,
  targetCardsTable,
  targetLogColumn,
} from "@/lib/character-target";
import { assertDb, db } from "@/lib/db";
import { parseJson } from "@/lib/utils";

function resolveCardUses(effects: unknown) {
  const parsed = parseJson<Array<{ type?: string; uses?: number }>>(effects, []);
  return parsed.find((effect) => effect.type === "uses_per_rest")?.uses ?? null;
}

export async function POST(request: Request) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as {
    characterId?: string;
    campaignCharacterId?: string;
    cardId?: string;
  };

  if (!body.cardId) {
    return jsonError("Carta é obrigatória.");
  }

  const target = await resolveCharacterTarget({
    characterId: body.characterId,
    campaignCharacterId: body.campaignCharacterId,
  });

  if (!target) {
    return jsonError("Personagem não encontrado.", 404);
  }

  const card = assertDb(
    await db.from("cards").select("*").eq("id", body.cardId).maybeSingle(),
    "Falha ao carregar carta.",
  ) as Record<string, unknown> | null;

  if (!card) {
    return jsonError("Carta não encontrada.", 404);
  }

  const uses = resolveCardUses(card.effects);
  const targetIdColumn =
    target.kind === "campaign" ? "campaign_character_id" : "character_id";

  assertDb(
    await db.from(targetCardsTable(target)).upsert(
      {
        [targetIdColumn]: target.id,
        card_id: body.cardId,
        status: String(card.category) === "dominio" ? "ativa" : "passiva",
        uses_max: uses,
        uses_current: uses,
      },
      {
        onConflict:
          target.kind === "campaign"
            ? "campaign_character_id,card_id"
            : "character_id,card_id",
      },
    ),
    "Falha ao atribuir carta.",
  );

  assertDb(
    await db.from("effect_logs").insert({
      [targetLogColumn(target)]: target.id,
      card_id: body.cardId,
      action: "assign_card",
      summary: `Carta atribuída: ${String(card.name)}.`,
    }),
    "Falha ao registrar atribuição de carta.",
  );

  revalidatePath("/master");
  revalidatePath("/player");
  if (target.kind === "base") {
    revalidatePath(`/player/characters/${target.id}`);
  }

  return NextResponse.json({ ok: true });
}
