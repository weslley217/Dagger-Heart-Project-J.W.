import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import { assertDb, db } from "@/lib/db";
import type { CampaignStatus } from "@/types/domain";

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
    isOpen?: boolean;
    status?: CampaignStatus;
  };

  if (typeof body.isOpen !== "boolean" && !body.status) {
    return jsonError("Nenhuma alteração informada.");
  }

  const membership = assertDb(
    await db
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", auth.session.userId)
      .eq("role", "MASTER")
      .maybeSingle(),
    "Falha ao validar permissão do mestre.",
  );

  if (!membership) {
    return jsonError("Você não tem permissão nesta campanha.", 403);
  }

  const nextStatus: CampaignStatus =
    body.status ??
    (body.isOpen ? "open" : "draft");

  assertDb(
    await db
      .from("campaigns")
      .update({
        is_open: typeof body.isOpen === "boolean" ? body.isOpen : nextStatus === "open",
        status: nextStatus,
      })
      .eq("id", campaignId),
    "Falha ao atualizar status da campanha.",
  );

  revalidatePath("/master");
  revalidatePath("/player");

  return NextResponse.json({ ok: true });
}
