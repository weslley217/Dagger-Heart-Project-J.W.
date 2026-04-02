import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import {
  resolveCharacterTarget,
  targetCharacterTable,
  targetLogColumn,
} from "@/lib/character-target";
import { assertDb, db } from "@/lib/db";
import { aplicarArmadura, atualizarHP, classificarDano } from "@/rules/damage";

export async function POST(request: Request) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as {
    characterId?: string;
    campaignCharacterId?: string;
    damageBruto?: number;
    usarArmadura?: boolean;
  };

  if (typeof body.damageBruto !== "number") {
    return jsonError("Parâmetros inválidos.");
  }

  const target = await resolveCharacterTarget({
    characterId: body.characterId,
    campaignCharacterId: body.campaignCharacterId,
  });

  if (!target) {
    return jsonError("Personagem não encontrado.", 404);
  }

  const threshold1 = Number(target.row.threshold1 ?? 7);
  const threshold2 = Number(target.row.threshold2 ?? 14);
  const armorCurrent = Number(target.row.armor_current ?? 0);
  const currentHp = Number(target.row.current_hp ?? 0);
  const totalHp = Number(target.row.total_hp ?? 1);

  const damagePoints = classificarDano(body.damageBruto, threshold1, threshold2);
  const armorResult = aplicarArmadura(damagePoints, armorCurrent, Boolean(body.usarArmadura));
  const hpResult = atualizarHP(currentHp, totalHp, armorResult.pontosDanoFinal);

  assertDb(
    await db
      .from(targetCharacterTable(target))
      .update({
        current_hp: hpResult.currentHPFinal,
        armor_current: armorResult.armorFinal,
        is_downed: hpResult.downed,
      })
      .eq("id", target.id),
    "Falha ao atualizar status de combate.",
  );

  const logColumn = targetLogColumn(target);
  assertDb(
    await db.from("damage_logs").insert({
      [logColumn]: target.id,
      damage_raw: body.damageBruto,
      damage_points: damagePoints,
      armor_used: Boolean(body.usarArmadura) && damagePoints > 0 && armorCurrent > 0,
      armor_before: armorCurrent,
      armor_after: armorResult.armorFinal,
      hp_before: currentHp,
      hp_after: hpResult.currentHPFinal,
      downed: hpResult.downed,
    }),
    "Falha ao registrar dano.",
  );

  assertDb(
    await db.from("effect_logs").insert({
      [logColumn]: target.id,
      action: "damage",
      summary: `Dano aplicado: ${body.damageBruto} bruto, ${armorResult.pontosDanoFinal} ponto(s) final(is).`,
    }),
    "Falha ao registrar efeito de dano.",
  );

  revalidatePath("/master");
  revalidatePath("/player");
  if (target.kind === "base") {
    revalidatePath(`/player/characters/${target.id}`);
  }

  return NextResponse.json({
    damagePoints,
    ...armorResult,
    ...hpResult,
  });
}
