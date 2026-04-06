import { NextResponse } from "next/server";
import { assertDb, db } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "MASTER") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id: campaignId } = await params;
  const body = (await req.json()) as { active: boolean };

  assertDb(
    await db
      .from("campaigns")
      .update({
        session_active: body.active,
        status: body.active ? "active" : "open",
      })
      .eq("id", campaignId),
  );

  return NextResponse.json({ ok: true, session_active: body.active });
}
