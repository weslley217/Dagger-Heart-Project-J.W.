import { NextResponse } from "next/server";
import { assertDb, db } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id: campaignId } = await params;
  const body = (await req.json()) as { map_tokens?: unknown[]; map_shapes?: unknown[] };

  const update: Record<string, unknown> = {};
  if (body.map_tokens !== undefined) update.map_tokens = body.map_tokens;
  if (body.map_shapes !== undefined) update.map_shapes = body.map_shapes;

  assertDb(
    await db
      .from("campaigns")
      .update(update)
      .eq("id", campaignId),
  );

  return NextResponse.json({ ok: true });
}
