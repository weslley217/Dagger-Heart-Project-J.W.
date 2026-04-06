import { NextResponse } from "next/server";
import { assertDb, db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { aplicarArmadura, atualizarHP, classificarDano } from "@/rules/damage";

type Params = { params: Promise<{ id: string; npcId: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { npcId } = await params;
  const body = (await req.json()) as { damageBruto: number; usarArmadura?: boolean };

  const { data: npc, error } = await db
    .from("campaign_npcs")
    .select("*")
    .eq("id", npcId)
    .single();

  if (error || !npc) {
    return NextResponse.json({ error: "NPC não encontrado." }, { status: 404 });
  }

  const damagePoints = classificarDano(body.damageBruto, npc.threshold1, npc.threshold2);
  const armor = aplicarArmadura(damagePoints, npc.armor_current, body.usarArmadura ?? true);
  const hpResult = atualizarHP(npc.current_hp, npc.total_hp, armor.pontosDanoFinal);

  // Auto health indicator based on HP percentage
  const hpPct = npc.total_hp > 0 ? hpResult.currentHPFinal / npc.total_hp : 0;
  let health_indicator: string;
  if (hpResult.downed) health_indicator = "desacordado";
  else if (hpPct >= 0.75) health_indicator = "plena_forma";
  else if (hpPct >= 0.5) health_indicator = "ferido";
  else if (hpPct >= 0.25) health_indicator = "gravemente_ferido";
  else health_indicator = "critico";

  assertDb(
    await db.from("campaign_npcs").update({
      current_hp: hpResult.currentHPFinal,
      armor_current: armor.armorFinal,
      is_downed: hpResult.downed,
      health_indicator,
    }).eq("id", npcId),
  );

  return NextResponse.json({
    damagePoints,
    hpBefore: npc.current_hp,
    hpAfter: hpResult.currentHPFinal,
    downed: hpResult.downed,
    health_indicator,
  });
}
