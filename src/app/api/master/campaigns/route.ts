import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import { assertDb, db } from "@/lib/db";
import { parseJson } from "@/lib/utils";

type RestrictionsInput = {
  startingLevel?: number;
  specialAbilities?: string[];
  bonusCards?: string[];
  customRules?: string;
};

function normalizeRestrictions(input: RestrictionsInput | undefined) {
  return {
    startingLevel:
      typeof input?.startingLevel === "number" ? Math.max(1, input.startingLevel) : 1,
    specialAbilities: Array.isArray(input?.specialAbilities)
      ? input.specialAbilities.filter((item): item is string => typeof item === "string")
      : [],
    bonusCards: Array.isArray(input?.bonusCards)
      ? input.bonusCards.filter((item): item is string => typeof item === "string")
      : [],
    customRules: typeof input?.customRules === "string" ? input.customRules : "",
  };
}

export async function GET() {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const membershipsRaw =
    assertDb(
      await db
        .from("campaign_members")
        .select("role,campaign:campaigns(*)")
        .eq("user_id", auth.session.userId)
        .eq("role", "MASTER"),
      "Falha ao carregar campanhas do mestre.",
    ) ?? [];

  const memberships = (membershipsRaw as Array<Record<string, unknown>>).map((row) => {
    const campaignRaw = row.campaign;
    const campaign =
      Array.isArray(campaignRaw) && campaignRaw.length
        ? (campaignRaw[0] as Record<string, unknown>)
        : ((campaignRaw as Record<string, unknown> | null | undefined) ?? null);

    return {
      role: String(row.role) as "MASTER" | "PLAYER",
      campaign,
    };
  });

  return NextResponse.json({
    campaigns: memberships
      .map((item) => item.campaign)
      .filter(Boolean)
      .map((campaign) => ({
        ...campaign,
        restrictions: normalizeRestrictions(
          parseJson<RestrictionsInput>(campaign!.restrictions, {}),
        ),
      })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    startLevel?: number;
    restrictions?: RestrictionsInput;
    specialRules?: string;
    isOpen?: boolean;
  };

  if (!body.name?.trim()) {
    return jsonError("Nome da campanha é obrigatório.");
  }

  const restrictions = normalizeRestrictions({
    ...(body.restrictions ?? {}),
    startingLevel: body.startLevel ?? body.restrictions?.startingLevel ?? 1,
  });

  const campaign = assertDb(
    await db
      .from("campaigns")
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        created_by: auth.session.userId,
        status: body.isOpen ? "open" : "draft",
        is_open: Boolean(body.isOpen),
        start_level: restrictions.startingLevel,
        restrictions,
        special_rules: body.specialRules?.trim() || restrictions.customRules || null,
        bonus_card_ids: restrictions.bonusCards,
      })
      .select("*")
      .single(),
    "Falha ao criar campanha.",
  ) as Record<string, unknown>;

  assertDb(
    await db.from("campaign_members").upsert(
      {
        campaign_id: String(campaign.id),
        user_id: auth.session.userId,
        role: "MASTER",
        can_manage: true,
      },
      { onConflict: "campaign_id,user_id" },
    ),
    "Falha ao vincular mestre na campanha.",
  );

  revalidatePath("/master");
  revalidatePath("/player");

  return NextResponse.json({
    message: `Campanha "${campaign.name}" criada com sucesso.`,
    campaign,
  });
}
