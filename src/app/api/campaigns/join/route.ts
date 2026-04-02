import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import { assertDb, db } from "@/lib/db";
import { createDefaultEquipment } from "@/lib/reference-data";
import { parseJson } from "@/lib/utils";

export async function POST(request: Request) {
  const auth = await requireApiSession("PLAYER");
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as {
    campaignId?: string;
    baseCharacterId?: string;
  };

  if (!body.campaignId || !body.baseCharacterId) {
    return jsonError("Campanha e personagem são obrigatórios.");
  }

  const membership = assertDb(
    await db
      .from("campaign_members")
      .select("campaign:campaigns(*)")
      .eq("campaign_id", body.campaignId)
      .eq("user_id", auth.session.userId)
      .maybeSingle(),
    "Falha ao validar vínculo com campanha.",
  ) as { campaign: Record<string, unknown> | null } | null;

  const campaign = membership?.campaign;
  if (!campaign) {
    return jsonError("Você não participa desta campanha.", 403);
  }

  if (!campaign.is_open) {
    return jsonError("A campanha ainda não está aberta pelo mestre.", 403);
  }

  const baseCharacter = assertDb(
    await db
      .from("characters")
      .select("*")
      .eq("id", body.baseCharacterId)
      .eq("owner_id", auth.session.userId)
      .maybeSingle(),
    "Falha ao carregar personagem base.",
  ) as Record<string, unknown> | null;

  if (!baseCharacter) {
    return jsonError("Personagem base não encontrado.", 404);
  }

  const existing = assertDb(
    await db
      .from("campaign_characters")
      .select("*")
      .eq("campaign_id", body.campaignId)
      .eq("base_character_id", body.baseCharacterId)
      .maybeSingle(),
    "Falha ao validar snapshot existente.",
  ) as Record<string, unknown> | null;

  if (existing) {
    return NextResponse.json({
      id: String(existing.id),
      message: "Snapshot da campanha já estava pronto.",
    });
  }

  const restrictions = parseJson<Record<string, unknown>>(campaign.restrictions, {});
  const startingLevel =
    typeof restrictions.startingLevel === "number"
      ? Math.max(1, restrictions.startingLevel)
      : Number(campaign.start_level ?? 1);
  const bonusCards =
    Array.isArray(restrictions.bonusCards) &&
    restrictions.bonusCards.every((item) => typeof item === "string")
      ? (restrictions.bonusCards as string[])
      : [];

  const snapshot = assertDb(
    await db
      .from("campaign_characters")
      .insert({
        campaign_id: body.campaignId,
        base_character_id: body.baseCharacterId,
        player_id: auth.session.userId,
        name: String(baseCharacter.name),
        level: Math.max(Number(baseCharacter.level ?? 1), startingLevel),
        short_description: String(baseCharacter.short_description ?? ""),
        class_key: String(baseCharacter.class_key),
        subclass_key: String(baseCharacter.subclass_key),
        ancestry_key: String(baseCharacter.ancestry_key),
        community_key: String(baseCharacter.community_key),
        domains: baseCharacter.domains ?? [],
        attributes: baseCharacter.attributes ?? {},
        proficiencies: baseCharacter.proficiencies ?? {},
        conditions: [],
        resources: baseCharacter.resources ?? {},
        equipment: baseCharacter.equipment ?? createDefaultEquipment(),
        druid_forms: baseCharacter.druid_forms ?? [],
        total_hp: Number(baseCharacter.total_hp ?? 6),
        current_hp: 0,
        armor_max: Number(baseCharacter.armor_max ?? 3),
        armor_current: Number(baseCharacter.armor_max ?? 3),
        threshold1: Number(baseCharacter.threshold1 ?? 7),
        threshold2: Number(baseCharacter.threshold2 ?? 14),
        evasion: Number(baseCharacter.evasion ?? 10),
        notes: baseCharacter.notes ?? null,
        is_downed: false,
        status: "active",
      })
      .select("*")
      .single(),
    "Falha ao criar snapshot da campanha.",
  ) as Record<string, unknown>;

  const baseLinks = (assertDb(
    await db
      .from("character_cards")
      .select("card_id,status,uses_max,uses_current,cooldown,notes")
      .eq("character_id", body.baseCharacterId),
    "Falha ao carregar cartas do personagem base.",
  ) ?? []) as Array<Record<string, unknown>>;

  const targetCardIds = [...new Set([...baseLinks.map((item) => String(item.card_id)), ...bonusCards])];

  const cardsById = new Map<string, Record<string, unknown>>();
  if (targetCardIds.length) {
    const cards = (assertDb(
      await db.from("cards").select("*").in("id", targetCardIds),
      "Falha ao carregar cartas da campanha.",
    ) ?? []) as Array<Record<string, unknown>>;
    for (const card of cards) {
      cardsById.set(String(card.id), card);
    }
  }

  for (const cardId of targetCardIds) {
    const baseLink = baseLinks.find((item) => String(item.card_id) === cardId);
    const card = cardsById.get(cardId);
    const status = baseLink?.status ?? (String(card?.category) === "dominio" ? "ativa" : "passiva");
    const usesMax = (baseLink?.uses_max as number | null | undefined) ?? null;
    const usesCurrent = (baseLink?.uses_current as number | null | undefined) ?? usesMax;

    assertDb(
      await db.from("campaign_character_cards").upsert(
        {
          campaign_character_id: String(snapshot.id),
          card_id: cardId,
          status,
          uses_max: usesMax,
          uses_current: usesCurrent,
          cooldown: (baseLink?.cooldown as string | null | undefined) ?? null,
          notes: (baseLink?.notes as string | null | undefined) ?? null,
        },
        { onConflict: "campaign_character_id,card_id" },
      ),
      "Falha ao copiar cartas para o snapshot da campanha.",
    );
  }

  assertDb(
    await db.from("effect_logs").insert({
      campaign_character_id: String(snapshot.id),
      action: "join_campaign",
      summary: `${String(baseCharacter.name)} entrou na campanha ${String(campaign.name)}.`,
    }),
    "Falha ao registrar entrada em campanha.",
  );

  revalidatePath("/player");
  revalidatePath("/master");

  return NextResponse.json({
    id: String(snapshot.id),
    message: "Campanha iniciada para o personagem.",
  });
}
