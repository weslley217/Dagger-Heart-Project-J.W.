import { NextResponse } from "next/server";
import { assertDb, db } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id: campaignId } = await params;

  const data = assertDb(
    await db.from("campaign_npcs").select("*").eq("campaign_id", campaignId).order("created_at"),
  );

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id: campaignId } = await params;
  const body = (await req.json()) as {
    name: string;
    npc_type?: string;
    level?: number;
    description?: string;
    total_hp?: number;
    armor_max?: number;
    threshold1?: number;
    threshold2?: number;
    evasion?: number;
    damage_dice?: string;
    attack_bonus?: number;
    token_color?: string;
    token_icon?: string;
    traits?: unknown[];
    actions?: unknown[];
    notes?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Nome do NPC é obrigatório." }, { status: 400 });
  }

  const hp = body.total_hp ?? 10;

  const data = assertDb(
    await db
      .from("campaign_npcs")
      .insert({
        campaign_id: campaignId,
        name: body.name.trim(),
        npc_type: body.npc_type ?? "monster",
        level: body.level ?? 1,
        description: body.description ?? null,
        total_hp: hp,
        current_hp: hp,
        armor_max: body.armor_max ?? 0,
        armor_current: body.armor_max ?? 0,
        threshold1: body.threshold1 ?? 5,
        threshold2: body.threshold2 ?? 10,
        evasion: body.evasion ?? 10,
        damage_dice: body.damage_dice ?? null,
        attack_bonus: body.attack_bonus ?? 0,
        token_color: body.token_color ?? "#ef4444",
        token_icon: body.token_icon ?? "monster",
        traits: body.traits ?? [],
        actions: body.actions ?? [],
        notes: body.notes ?? null,
      })
      .select()
      .single(),
  );

  return NextResponse.json(data, { status: 201 });
}
