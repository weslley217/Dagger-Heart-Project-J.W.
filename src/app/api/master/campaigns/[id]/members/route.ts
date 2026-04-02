import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import { assertDb, db } from "@/lib/db";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const { id: campaignId } = await params;
  const body = (await request.json()) as {
    userId?: string;
    role?: "PLAYER" | "MASTER";
    canManage?: boolean;
  };

  if (!body.userId) {
    return jsonError("Selecione um jogador para adicionar.");
  }

  const membership = assertDb(
    await db
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", auth.session.userId)
      .eq("role", "MASTER")
      .maybeSingle(),
    "Falha ao validar acesso do mestre.",
  );

  if (!membership) {
    return jsonError("Você não tem permissão nesta campanha.", 403);
  }

  assertDb(
    await db.from("campaign_members").upsert(
      {
        campaign_id: campaignId,
        user_id: body.userId,
        role: body.role ?? "PLAYER",
        can_manage: Boolean(body.canManage),
      },
      { onConflict: "campaign_id,user_id" },
    ),
    "Falha ao adicionar jogador na campanha.",
  );

  revalidatePath("/master");
  revalidatePath("/player");

  return NextResponse.json({ ok: true });
}
