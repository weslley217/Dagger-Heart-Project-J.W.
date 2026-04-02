import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import {
  resolveCharacterTarget,
  targetCharacterTable,
  targetLogColumn,
} from "@/lib/character-target";
import { assertDb, db } from "@/lib/db";

export async function POST(request: Request) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as {
    characterId?: string;
    campaignCharacterId?: string;
  };

  const target = await resolveCharacterTarget({
    characterId: body.characterId,
    campaignCharacterId: body.campaignCharacterId,
  });

  if (!target) {
    return jsonError("Personagem não encontrado.", 404);
  }

  const logColumn = targetLogColumn(target);
  const lastLog = assertDb(
    await db
      .from("damage_logs")
      .select("*")
      .eq(logColumn, target.id)
      .is("undone_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "Falha ao buscar último dano.",
  ) as Record<string, unknown> | null;

  if (!lastLog) {
    return jsonError("Nenhuma ação de dano disponível para desfazer.", 404);
  }

  assertDb(
    await db
      .from(targetCharacterTable(target))
      .update({
        current_hp: Number(lastLog.hp_before ?? 0),
        armor_current: Number(lastLog.armor_before ?? 0),
        is_downed: Number(lastLog.hp_before ?? 0) >= Number(target.row.total_hp ?? 1),
      })
      .eq("id", target.id),
    "Falha ao restaurar estado anterior.",
  );

  assertDb(
    await db
      .from("damage_logs")
      .update({
        undone_at: new Date().toISOString(),
      })
      .eq("id", String(lastLog.id)),
    "Falha ao marcar log como desfeito.",
  );

  assertDb(
    await db.from("effect_logs").insert({
      [logColumn]: target.id,
      action: "undo_damage",
      summary: "Última aplicação de dano desfeita pelo mestre.",
    }),
    "Falha ao registrar desfazer de dano.",
  );

  revalidatePath("/master");
  revalidatePath("/player");
  if (target.kind === "base") {
    revalidatePath(`/player/characters/${target.id}`);
  }

  return NextResponse.json({ ok: true });
}
