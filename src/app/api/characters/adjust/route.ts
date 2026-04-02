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

type AdjustmentBody = {
  characterId?: string;
  campaignCharacterId?: string;
  delta?: {
    currentHp?: number;
    armorCurrent?: number;
    hope?: number;
    fatigue?: number;
    stress?: number;
    gold?: number;
  };
  set?: {
    currentHp?: number;
    armorCurrent?: number;
    hope?: number;
    fatigue?: number;
    stress?: number;
    gold?: number;
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as AdjustmentBody;
  if (!body.delta && !body.set) {
    return jsonError("Nenhum ajuste informado.");
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

  const totalHp = readNumber(target.row.total_hp, 1);
  const armorMax = readNumber(target.row.armor_max, 0);
  const currentHp = readNumber(target.row.current_hp, 0);
  const armorCurrent = readNumber(target.row.armor_current, 0);
  const resources = parseJson<Record<string, unknown>>(target.row.resources, {});

  const hopeMax = readNumber(resources.hopeMax, 6);
  const fatigueMax = readNumber(resources.fatigueMax, 6);
  const stressMax = readNumber(resources.stressMax, 6);

  const nextCurrentHp = clamp(
    body.set?.currentHp ?? currentHp + (body.delta?.currentHp ?? 0),
    0,
    totalHp,
  );
  const nextArmorCurrent = clamp(
    body.set?.armorCurrent ?? armorCurrent + (body.delta?.armorCurrent ?? 0),
    0,
    armorMax,
  );

  const nextResources = {
    ...resources,
    hope: clamp(
      body.set?.hope ?? readNumber(resources.hope, 0) + (body.delta?.hope ?? 0),
      0,
      hopeMax,
    ),
    fatigue: clamp(
      body.set?.fatigue ??
        readNumber(resources.fatigue, 0) + (body.delta?.fatigue ?? 0),
      0,
      fatigueMax,
    ),
    stress: clamp(
      body.set?.stress ?? readNumber(resources.stress, 0) + (body.delta?.stress ?? 0),
      0,
      stressMax,
    ),
    gold: Math.max(
      body.set?.gold ?? readNumber(resources.gold, 0) + (body.delta?.gold ?? 0),
      0,
    ),
  };

  const previousHope = readNumber(resources.hope, 0);
  const previousFatigue = readNumber(resources.fatigue, 0);
  const previousStress = readNumber(resources.stress, 0);
  const previousGold = readNumber(resources.gold, 0);

  assertDb(
    await db
      .from(targetCharacterTable(target))
      .update({
        current_hp: nextCurrentHp,
        armor_current: nextArmorCurrent,
        resources: nextResources,
        is_downed: nextCurrentHp >= totalHp,
      })
      .eq("id", target.id),
    "Falha ao ajustar recursos do personagem.",
  );

  const logColumn = targetLogColumn(target);
  assertDb(
    await db.from("effect_logs").insert({
      [logColumn]: target.id,
      action: "adjust_resources",
      summary: `Ajuste (${auth.session.role === "MASTER" ? "mestre" : "jogador"}): HP ${currentHp}->${nextCurrentHp}, Armadura ${armorCurrent}->${nextArmorCurrent}, Esperanca ${previousHope}->${nextResources.hope}, Fadiga ${previousFatigue}->${nextResources.fatigue}, Estresse ${previousStress}->${nextResources.stress}, Ouro ${previousGold}->${nextResources.gold}.`,
      details: {
        delta: body.delta ?? {},
        set: body.set ?? {},
      },
    }),
    "Falha ao registrar ajuste de recursos.",
  );

  revalidatePath("/player");
  revalidatePath("/master");
  if (target.kind === "base") {
    revalidatePath(`/player/characters/${target.id}`);
  }

  return NextResponse.json({
    ok: true,
    currentHp: nextCurrentHp,
    armorCurrent: nextArmorCurrent,
    resources: nextResources,
  });
}
