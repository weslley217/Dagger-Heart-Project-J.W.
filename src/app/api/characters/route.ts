import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { jsonError, requireApiSession } from "@/lib/api-session";
import { assertDb, db } from "@/lib/db";
import { isAutomaticCardForSelection } from "@/lib/reference-cards";
import { createDefaultEquipment, sheetDefaults } from "@/lib/reference-data";
import { parseJson } from "@/lib/utils";
import type { CharacterEquipment } from "@/types/domain";

type CreateCharacterBody = {
  name?: string;
  level?: number;
  shortDescription?: string;
  classKey?: string;
  subclassKey?: string;
  ancestryKey?: string;
  communityKey?: string;
  domains?: string[];
  attributes?: Record<string, number>;
  proficiencies?: Record<string, unknown>;
  totalHp?: number;
  armorMax?: number;
  threshold1?: number;
  threshold2?: number;
  evasion?: number;
  resources?: Record<string, unknown>;
  notes?: string;
  selectedCardIds?: string[];
  druidForms?: string[];
  equipment?: CharacterEquipment;
  campaignId?: string;
};

function resolveCardUses(effects: unknown) {
  const parsed = parseJson<Array<{ type?: string; uses?: number }>>(effects, []);
  return parsed.find((effect) => effect.type === "uses_per_rest")?.uses ?? null;
}

export async function POST(request: Request) {
  const auth = await requireApiSession("PLAYER");
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json()) as CreateCharacterBody;

  if (!body.name || !body.shortDescription || !body.classKey || !body.subclassKey) {
    return jsonError("Campos obrigatórios ausentes.");
  }

  const classKey = body.classKey;
  const subclassKey = body.subclassKey;
  const shortDescription = body.shortDescription;
  const ancestryKey = body.ancestryKey ?? "humano";
  const communityKey = body.communityKey ?? "aristocratica";

  const baseCharacter = assertDb(
    await db
      .from("characters")
      .insert({
        owner_id: auth.session.userId,
        name: body.name,
        level: body.level ?? sheetDefaults.startingLevel,
        short_description: shortDescription,
        class_key: classKey,
        subclass_key: subclassKey,
        ancestry_key: ancestryKey,
        community_key: communityKey,
        domains: body.domains ?? [],
        attributes: body.attributes ?? {},
        proficiencies: body.proficiencies ?? {},
        conditions: [],
        resources:
          body.resources ??
          ({
            hope: sheetDefaults.startingHope,
            hopeMax: sheetDefaults.maxHope,
            fatigue: 0,
            fatigueMax: sheetDefaults.startingFatigue,
            gold: 0,
            stress: 0,
            stressMax: 6,
          } satisfies Record<string, unknown>),
        equipment: body.equipment ?? createDefaultEquipment(),
        druid_forms: body.druidForms ?? [],
        total_hp: body.totalHp ?? 6,
        current_hp: 0,
        armor_max: body.armorMax ?? 3,
        armor_current: body.armorMax ?? 3,
        threshold1: body.threshold1 ?? 7,
        threshold2: body.threshold2 ?? 14,
        evasion: body.evasion ?? 10,
        notes: body.notes ?? null,
        is_downed: false,
      })
      .select("*")
      .single(),
    "Falha ao criar ficha.",
  ) as Record<string, unknown>;

  const allCards = (assertDb(
    await db.from("cards").select("*").limit(3000),
    "Falha ao consultar cartas automáticas.",
  ) ?? []) as Array<Record<string, unknown>>;

  const automaticCards = allCards.filter((card) =>
    isAutomaticCardForSelection(
      {
        category: String(card.category) as
          | "classe"
          | "subclasse"
          | "dominio"
          | "comunidade"
          | "ancestralidade"
          | "outros",
        classKey: (card.class_key as string | null | undefined) ?? null,
        subclassKey: (card.subclass_key as string | null | undefined) ?? null,
        name: String(card.name),
        tagKey: (card.tag_key as string | null | undefined) ?? null,
      },
      {
        classKey,
        subclassKey,
        ancestryKey,
        communityKey,
      },
    ),
  );

  const selectedCardIds = [
    ...new Set([
      ...(body.selectedCardIds ?? []),
      ...automaticCards.map((card) => String(card.id)),
    ]),
  ];

  let selectedCards: Array<Record<string, unknown>> = [];
  if (selectedCardIds.length) {
    selectedCards = (assertDb(
      await db.from("cards").select("*").in("id", selectedCardIds),
      "Falha ao carregar cartas selecionadas.",
    ) ?? []) as Array<Record<string, unknown>>;
  }

  for (const card of selectedCards) {
    const uses = resolveCardUses(card.effects);
    assertDb(
      await db.from("character_cards").upsert(
        {
          character_id: String(baseCharacter.id),
          card_id: String(card.id),
          status: String(card.category) === "dominio" ? "ativa" : "passiva",
          uses_max: uses,
          uses_current: uses,
        },
        { onConflict: "character_id,card_id" },
      ),
      "Falha ao vincular carta à ficha.",
    );
  }

  assertDb(
    await db.from("effect_logs").insert({
      character_id: String(baseCharacter.id),
      action: "create_character",
      summary: `Ficha criada para ${String(baseCharacter.name)}.`,
    }),
    "Falha ao registrar log de criação.",
  );

  let campaignCharacterId: string | null = null;
  if (body.campaignId) {
    const membership = assertDb(
      await db
        .from("campaign_members")
        .select("role,campaign:campaigns(*)")
        .eq("campaign_id", body.campaignId)
        .eq("user_id", auth.session.userId)
        .maybeSingle(),
      "Falha ao validar campanha.",
    ) as { role: "PLAYER" | "MASTER"; campaign: Record<string, unknown> | null } | null;

    if (!membership?.campaign) {
      return jsonError("Você não participa desta campanha.", 403);
    }

    const restrictions = parseJson<Record<string, unknown>>(membership.campaign.restrictions, {});
    const campaignStartLevel =
      typeof restrictions.startingLevel === "number"
        ? Math.max(1, restrictions.startingLevel)
        : Number(membership.campaign.start_level ?? 1);
    const bonusCards =
      Array.isArray(restrictions.bonusCards) && restrictions.bonusCards.length
        ? restrictions.bonusCards.filter((item): item is string => typeof item === "string")
        : [];

    const snapshotLevel = Math.max(Number(baseCharacter.level ?? 1), campaignStartLevel);

    const campaignCharacter = assertDb(
      await db
        .from("campaign_characters")
        .upsert(
          {
            campaign_id: body.campaignId,
            base_character_id: String(baseCharacter.id),
            player_id: auth.session.userId,
            name: String(baseCharacter.name),
            level: snapshotLevel,
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
            equipment: baseCharacter.equipment ?? body.equipment ?? createDefaultEquipment(),
            druid_forms: baseCharacter.druid_forms ?? body.druidForms ?? [],
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
          },
          { onConflict: "campaign_id,base_character_id" },
        )
        .select("*")
        .single(),
      "Falha ao criar snapshot do personagem na campanha.",
    ) as Record<string, unknown>;

    campaignCharacterId = String(campaignCharacter.id);

    const campaignCardIds = [...new Set([...selectedCardIds, ...bonusCards])];
    if (campaignCardIds.length) {
      const cardsToClone = (assertDb(
        await db.from("cards").select("*").in("id", campaignCardIds),
        "Falha ao carregar cartas da campanha.",
      ) ?? []) as Array<Record<string, unknown>>;

      for (const card of cardsToClone) {
        const uses = resolveCardUses(card.effects);
        assertDb(
          await db.from("campaign_character_cards").upsert(
            {
              campaign_character_id: campaignCharacterId,
              card_id: String(card.id),
              status: String(card.category) === "dominio" ? "ativa" : "passiva",
              uses_max: uses,
              uses_current: uses,
            },
            { onConflict: "campaign_character_id,card_id" },
          ),
          "Falha ao vincular carta ao personagem da campanha.",
        );
      }
    }

    assertDb(
      await db.from("effect_logs").insert({
        campaign_character_id: campaignCharacterId,
        action: "join_campaign",
        summary: `${String(baseCharacter.name)} entrou na campanha.`,
      }),
      "Falha ao registrar entrada na campanha.",
    );
  }

  revalidatePath("/player");
  revalidatePath(`/player/characters/${String(baseCharacter.id)}`);
  revalidatePath("/master");

  return NextResponse.json({
    id: String(baseCharacter.id),
    campaignCharacterId,
  });
}
