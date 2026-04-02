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
    condition?: string;
    mode?: "add" | "remove";
  };

  if (!body.condition || !body.mode) {
    return jsonError("Parâmetros inválidos.");
  }

  const target = await resolveCharacterTarget({
    characterId: body.characterId,
    campaignCharacterId: body.campaignCharacterId,
  });

  if (!target) {
    return jsonError("Personagem não encontrado.", 404);
  }

  const currentConditions = parseJson<string[]>(target.row.conditions, []);
  const nextConditions =
    body.mode === "add"
      ? [...new Set([...currentConditions, body.condition])]
      : currentConditions.filter((item) => item !== body.condition);

  assertDb(
    await db
      .from(targetCharacterTable(target))
      .update({
        conditions: nextConditions,
      })
      .eq("id", target.id),
    "Falha ao atualizar condições.",
  );

  assertDb(
    await db.from("effect_logs").insert({
      [targetLogColumn(target)]: target.id,
      action: body.mode === "add" ? "add_condition" : "remove_condition",
      summary: `${body.mode === "add" ? "Condição aplicada" : "Condição removida"}: ${body.condition}.`,
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
