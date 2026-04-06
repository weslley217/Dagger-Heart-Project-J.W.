import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import {
  resolveCharacterTarget,
  targetCharacterTable,
  targetLogColumn,
} from "@/lib/character-target";
import { assertDb, db } from "@/lib/db";
import { parseJson } from "@/lib/utils";

export async function POST(request: Request) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as {
    characterId?: string;
    campaignCharacterId?: string;
    campaignNpcId?: string;
    condition?: string;
    action?: "add" | "remove";
    mode?: "add" | "remove"; // legacy
    duration?: number;
  };

  const resolvedAction = body.action ?? body.mode;
  if (!body.condition || !resolvedAction) {
    return jsonError("Parâmetros inválidos.");
  }

  // ── NPC condition path ──────────────────────────────────────────────────
  if (body.campaignNpcId) {
    const { data: npc, error } = await db
      .from("campaign_npcs")
      .select("id, conditions")
      .eq("id", body.campaignNpcId)
      .single();

    if (error || !npc) return jsonError("NPC não encontrado.", 404);

    type Condition = { label: string; duration?: number };
    const current: Condition[] = parseJson<Condition[]>(npc.conditions, []);
    const next: Condition[] =
      resolvedAction === "add"
        ? [
            ...current.filter((c) => c.label !== body.condition),
            { label: body.condition!, ...(body.duration ? { duration: body.duration } : {}) },
          ]
        : current.filter((c) => c.label !== body.condition);

    assertDb(
      await db.from("campaign_npcs").update({ conditions: next }).eq("id", npc.id),
      "Falha ao atualizar condições do NPC.",
    );

    return NextResponse.json({ ok: true });
  }

  // ── Character/campaign-character path ───────────────────────────────────
  const target = await resolveCharacterTarget({
    characterId: body.characterId,
    campaignCharacterId: body.campaignCharacterId,
  });

  if (!target) {
    return jsonError("Personagem não encontrado.", 404);
  }

  type Condition = { label: string; duration?: number };
  const currentConditions = parseJson<Condition[]>(target.row.conditions, []);
  const nextConditions: Condition[] =
    resolvedAction === "add"
      ? [
          ...currentConditions.filter((c) => c.label !== body.condition),
          { label: body.condition!, ...(body.duration ? { duration: body.duration } : {}) },
        ]
      : currentConditions.filter((c) => c.label !== body.condition);

  assertDb(
    await db
      .from(targetCharacterTable(target))
      .update({ conditions: nextConditions })
      .eq("id", target.id),
    "Falha ao atualizar condições.",
  );

  assertDb(
    await db.from("effect_logs").insert({
      [targetLogColumn(target)]: target.id,
      action: resolvedAction === "add" ? "add_condition" : "remove_condition",
      summary: `${resolvedAction === "add" ? "Condição aplicada" : "Condição removida"}: ${body.condition}.`,
    }),
    "Falha ao registrar log de condição.",
  );

  revalidatePath("/master");
  revalidatePath("/player");
  if (target.kind === "base") {
    revalidatePath(`/player/characters/${target.id}`);
  }

  return NextResponse.json({ ok: true });
}
