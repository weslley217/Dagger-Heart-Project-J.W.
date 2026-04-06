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
    await db.from("campaign_turns").select("*").eq("campaign_id", campaignId).order("position"),
  );

  return NextResponse.json(data ?? []);
}

// Replace entire turn order
export async function PUT(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id: campaignId } = await params;
  const body = (await req.json()) as {
    turns: Array<{
      entity_type: "player" | "npc";
      entity_id: string;
      entity_name: string;
      initiative: number;
    }>;
  };

  // Delete existing turns for this campaign
  await db.from("campaign_turns").delete().eq("campaign_id", campaignId);

  if (!body.turns?.length) {
    return NextResponse.json({ ok: true });
  }

  const rows = body.turns.map((t, idx) => ({
    campaign_id: campaignId,
    entity_type: t.entity_type,
    entity_id: t.entity_id,
    entity_name: t.entity_name,
    initiative: t.initiative,
    position: idx,
    is_active: idx === 0,
  }));

  const data = assertDb(await db.from("campaign_turns").insert(rows).select());
  return NextResponse.json(data);
}

// Advance to next turn
export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id: campaignId } = await params;
  const body = (await req.json()) as { action: "next" | "prev" | "set"; position?: number };

  const turns = assertDb(
    await db.from("campaign_turns").select("*").eq("campaign_id", campaignId).order("position"),
  ) ?? [];

  if (!turns.length) return NextResponse.json({ ok: true });

  const activeIdx = turns.findIndex((t) => t.is_active);
  let newIdx = 0;

  if (body.action === "next") {
    newIdx = activeIdx < turns.length - 1 ? activeIdx + 1 : 0;
  } else if (body.action === "prev") {
    newIdx = activeIdx > 0 ? activeIdx - 1 : turns.length - 1;
  } else if (body.action === "set" && body.position !== undefined) {
    newIdx = body.position;
  }

  // Deactivate all, activate new
  await db.from("campaign_turns").update({ is_active: false }).eq("campaign_id", campaignId);
  await db.from("campaign_turns").update({ is_active: true }).eq("id", turns[newIdx].id);

  // Tick condition durations on new turn start for the entity becoming active
  const activeTurn = turns[newIdx];
  if (activeTurn.entity_type === "player") {
    const { data: cc } = await db
      .from("campaign_characters")
      .select("id, conditions")
      .eq("id", activeTurn.entity_id)
      .single();

    if (cc) {
      const conditions = (cc.conditions as Array<{ label: string; duration?: number }>) ?? [];
      const updated = conditions
        .map((c) => (c.duration !== undefined ? { ...c, duration: c.duration - 1 } : c))
        .filter((c) => c.duration === undefined || c.duration > 0);
      await db.from("campaign_characters").update({ conditions: updated }).eq("id", cc.id);
    }
  } else if (activeTurn.entity_type === "npc") {
    const { data: npc } = await db
      .from("campaign_npcs")
      .select("id, conditions")
      .eq("id", activeTurn.entity_id)
      .single();

    if (npc) {
      const conditions = (npc.conditions as Array<{ label: string; duration?: number }>) ?? [];
      const updated = conditions
        .map((c) => (c.duration !== undefined ? { ...c, duration: c.duration - 1 } : c))
        .filter((c) => c.duration === undefined || c.duration > 0);
      await db.from("campaign_npcs").update({ conditions: updated }).eq("id", npc.id);
    }
  }

  return NextResponse.json({ ok: true, newPosition: newIdx });
}
