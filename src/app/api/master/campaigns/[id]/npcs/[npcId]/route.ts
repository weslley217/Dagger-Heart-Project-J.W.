import { NextResponse } from "next/server";
import { assertDb, db } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string; npcId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { npcId } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  // Only allow safe fields to be updated
  const allowed = [
    "name", "npc_type", "level", "description", "total_hp", "current_hp",
    "armor_max", "armor_current", "threshold1", "threshold2", "evasion",
    "damage_dice", "attack_bonus", "conditions", "health_indicator",
    "visible_to_players", "token_x", "token_y", "token_color", "token_icon",
    "is_downed", "traits", "actions", "notes",
  ];

  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }

  const data = assertDb(
    await db.from("campaign_npcs").update(patch).eq("id", npcId).select().single(),
  );

  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { npcId } = await params;
  assertDb(await db.from("campaign_npcs").delete().eq("id", npcId));

  return NextResponse.json({ ok: true });
}
