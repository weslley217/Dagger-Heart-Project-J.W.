import { assertDb, db } from "@/lib/db";
import {
  parseCard,
  parseCharacterDetail,
  parseCharacterSummary,
} from "@/lib/serializers";
import type {
  AppUserSummary,
  CampaignRestrictions,
  CampaignSummary,
  MasterCharacterDetail,
} from "@/types/domain";

const defaultRestrictions: CampaignRestrictions = {
  startingLevel: 1,
  specialAbilities: [],
  bonusCards: [],
  customRules: "",
};

function normalizeRestrictions(value: unknown): CampaignRestrictions {
  if (!value || typeof value !== "object") {
    return defaultRestrictions;
  }

  const payload = value as Partial<CampaignRestrictions>;
  return {
    startingLevel:
      typeof payload.startingLevel === "number"
        ? Math.max(1, Math.floor(payload.startingLevel))
        : 1,
    specialAbilities: Array.isArray(payload.specialAbilities)
      ? payload.specialAbilities.filter((item): item is string => typeof item === "string")
      : [],
    bonusCards: Array.isArray(payload.bonusCards)
      ? payload.bonusCards.filter((item): item is string => typeof item === "string")
      : [],
    customRules: typeof payload.customRules === "string" ? payload.customRules : "",
  };
}

function normalizeCampaign(
  raw: Record<string, unknown>,
  memberCount: number,
  myRole?: "MASTER" | "PLAYER",
): CampaignSummary {
  return {
    id: String(raw.id),
    name: String(raw.name),
    description: (raw.description as string | null | undefined) ?? null,
    status: String(raw.status ?? "draft") as CampaignSummary["status"],
    isOpen: Boolean(raw.is_open),
    startLevel: Number(raw.start_level ?? 1),
    restrictions: normalizeRestrictions(raw.restrictions),
    specialRules: (raw.special_rules as string | null | undefined) ?? null,
    createdAt: new Date(String(raw.created_at)).toISOString(),
    memberCount,
    myRole,
  };
}

async function getCampaignCounts(campaignIds: string[]) {
  if (!campaignIds.length) {
    return new Map<string, number>();
  }

  const rows =
    assertDb(
      await db
        .from("campaign_members")
        .select("campaign_id")
        .in("campaign_id", campaignIds),
      "Falha ao carregar membros de campanha.",
    ) ?? [];

  const counts = new Map<string, number>();
  for (const row of rows as Array<{ campaign_id: string }>) {
    counts.set(row.campaign_id, (counts.get(row.campaign_id) ?? 0) + 1);
  }
  return counts;
}

export async function getPlayerCampaigns(userId: string) {
  const memberships =
    assertDb(
      await db
        .from("campaign_members")
        .select("role,campaign:campaigns(*)")
        .eq("user_id", userId),
      "Falha ao carregar campanhas do jogador.",
    ) ?? [];

  const campaigns = (memberships as Array<{ role: "MASTER" | "PLAYER"; campaign: unknown }>)
    .map((entry) => ({
      role: entry.role,
      campaign: entry.campaign as Record<string, unknown> | null,
    }))
    .filter((entry) => entry.campaign);

  const ids = campaigns.map((entry) => String(entry.campaign!.id));
  const counts = await getCampaignCounts(ids);

  return campaigns.map((entry) =>
    normalizeCampaign(entry.campaign!, counts.get(String(entry.campaign!.id)) ?? 0, entry.role),
  );
}

export async function getPlayerDashboard(userId: string) {
  const [characterRows, cardRows, campaigns] = await Promise.all([
    db.from("characters").select("*").eq("owner_id", userId).order("updated_at", {
      ascending: false,
    }),
    db.from("cards").select("*").order("updated_at", { ascending: false }).limit(1000),
    getPlayerCampaigns(userId),
  ]);

  const characters = assertDb(characterRows, "Falha ao carregar personagens do jogador.") ?? [];
  const cards = assertDb(cardRows, "Falha ao carregar cartas do jogador.") ?? [];

  return {
    characters: (characters as Array<Record<string, unknown>>).map(parseCharacterSummary),
    cards: (cards as Array<Record<string, unknown>>).map(parseCard),
    campaigns: campaigns.filter((campaign) => campaign.isOpen),
  };
}

export async function getCharacterSheet(characterId: string, ownerId?: string) {
  const query = db.from("characters").select("*").eq("id", characterId);
  const characterResult = ownerId ? query.eq("owner_id", ownerId).maybeSingle() : query.maybeSingle();

  const character = assertDb(
    await characterResult,
    "Falha ao carregar ficha do personagem.",
  ) as Record<string, unknown> | null;

  if (!character) {
    return null;
  }

  const [cardLinks, damageLogs, effectLogs] = await Promise.all([
    db
      .from("character_cards")
      .select("id,status,uses_max,uses_current,cooldown,notes,card:cards(*)")
      .eq("character_id", characterId)
      .order("assigned_at", { ascending: true }),
    db
      .from("damage_logs")
      .select("*")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false })
      .limit(12),
    db
      .from("effect_logs")
      .select("*")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const cards = (assertDb(cardLinks, "Falha ao carregar cartas do personagem.") ??
    []) as Array<Record<string, unknown>>;
  const damages = (assertDb(damageLogs, "Falha ao carregar histórico de dano.") ??
    []) as Array<Record<string, unknown>>;
  const effects = (assertDb(effectLogs, "Falha ao carregar histórico de efeitos.") ??
    []) as Array<Record<string, unknown>>;

  return parseCharacterDetail({
    ...character,
    cards: cards.map((row) => ({
      ...row,
      card: (row.card as Record<string, unknown>) ?? {},
    })),
    damageLogs: damages,
    effectLogs: effects,
  });
}

export async function getCampaignCharacterSheet(
  campaignCharacterId: string,
  options?: { playerId?: string; campaignId?: string },
) {
  let query = db.from("campaign_characters").select("*").eq("id", campaignCharacterId);
  if (options?.playerId) {
    query = query.eq("player_id", options.playerId);
  }
  if (options?.campaignId) {
    query = query.eq("campaign_id", options.campaignId);
  }

  const campaignCharacter = assertDb(
    await query.maybeSingle(),
    "Falha ao carregar ficha da campanha.",
  ) as Record<string, unknown> | null;

  if (!campaignCharacter) {
    return null;
  }

  const [cardLinks, damageLogs, effectLogs] = await Promise.all([
    db
      .from("campaign_character_cards")
      .select("id,status,uses_max,uses_current,cooldown,notes,card:cards(*)")
      .eq("campaign_character_id", campaignCharacterId)
      .order("assigned_at", { ascending: true }),
    db
      .from("damage_logs")
      .select("*")
      .eq("campaign_character_id", campaignCharacterId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("effect_logs")
      .select("*")
      .eq("campaign_character_id", campaignCharacterId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const cards = (assertDb(cardLinks, "Falha ao carregar cartas da campanha.") ??
    []) as Array<Record<string, unknown>>;
  const damages = (assertDb(damageLogs, "Falha ao carregar danos da campanha.") ??
    []) as Array<Record<string, unknown>>;
  const effects = (assertDb(effectLogs, "Falha ao carregar efeitos da campanha.") ??
    []) as Array<Record<string, unknown>>;

  return parseCharacterDetail({
    ...campaignCharacter,
    cards: cards.map((row) => ({
      ...row,
      card: (row.card as Record<string, unknown>) ?? {},
    })),
    damageLogs: damages,
    effectLogs: effects,
  });
}

export async function getCampaignCharactersForPlayer(campaignId: string, playerId: string) {
  const [campaignRaw, charactersRaw] = await Promise.all([
    db.from("campaigns").select("*").eq("id", campaignId).maybeSingle(),
    db
      .from("campaign_characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("player_id", playerId)
      .order("updated_at", { ascending: false }),
  ]);

  const campaign = assertDb(campaignRaw, "Falha ao carregar campanha.") as
    | Record<string, unknown>
    | null;
  const characters = (assertDb(
    charactersRaw,
    "Falha ao carregar personagens da campanha.",
  ) ?? []) as Array<Record<string, unknown>>;

  if (!campaign) {
    return null;
  }

  return {
    campaign: normalizeCampaign(campaign, 0, "PLAYER"),
    characters: characters.map((row) => ({
      ...parseCharacterSummary(row),
      campaignCharacterId: String(row.id),
      campaignId,
      baseCharacterId: (row.base_character_id as string | null | undefined) ?? null,
      playerId: String(row.player_id),
      playerName: "",
    })),
  };
}

export async function getMasterDashboard(masterUserId: string) {
  const [campaigns, usersRaw, cardsRaw] = await Promise.all([
    getPlayerCampaigns(masterUserId),
    db
      .from("app_users")
      .select("*")
      .order("role", { ascending: false })
      .order("display_name", { ascending: true }),
    db.from("cards").select("*").order("updated_at", { ascending: false }).limit(1000),
  ]);

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const [campaignCharactersRaw, memberRows] = await Promise.all([
    campaignIds.length
      ? db
          .from("campaign_characters")
          .select("*,player:app_users(id,display_name,username)")
          .in("campaign_id", campaignIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    campaignIds.length
      ? db
          .from("campaign_members")
          .select("campaign_id,user_id,role,user:app_users(id,username,display_name,role,active,created_at)")
          .in("campaign_id", campaignIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const users = (assertDb(usersRaw, "Falha ao carregar usuários.") ??
    []) as Array<Record<string, unknown>>;
  const cards = (assertDb(cardsRaw, "Falha ao carregar cartas.") ??
    []) as Array<Record<string, unknown>>;
  const campaignCharacters = (assertDb(
    campaignCharactersRaw as { data: unknown; error: { message: string } | null },
    "Falha ao carregar personagens de campanha.",
  ) ?? []) as Array<Record<string, unknown>>;
  const members = (assertDb(
    memberRows as { data: unknown; error: { message: string } | null },
    "Falha ao carregar membros das campanhas.",
  ) ?? []) as Array<Record<string, unknown>>;

  const memberUsersByCampaign = new Map<string, AppUserSummary[]>();
  for (const member of members) {
    const campaignId = String(member.campaign_id);
    const user = member.user as Record<string, unknown> | null;
    if (!user) {
      continue;
    }

    const normalized: AppUserSummary = {
      id: String(user.id),
      username: String(user.username),
      displayName: String(user.display_name),
      role: String(user.role) as AppUserSummary["role"],
      active: Boolean(user.active),
      createdAt: new Date(String(user.created_at)).toISOString(),
    };

    const collection = memberUsersByCampaign.get(campaignId) ?? [];
    collection.push(normalized);
    memberUsersByCampaign.set(campaignId, collection);
  }

  const normalizedUsers: AppUserSummary[] = users.map((row) => ({
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    role: String(row.role) as AppUserSummary["role"],
    active: Boolean(row.active),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));

  const campaignCharacterIds = campaignCharacters.map((row) => String(row.id));
  const [campaignCardLinksRaw, damageLogsRaw, effectLogsRaw] = await Promise.all([
    campaignCharacterIds.length
      ? db
          .from("campaign_character_cards")
          .select("id,status,uses_max,uses_current,cooldown,notes,campaign_character_id,card:cards(*)")
          .in("campaign_character_id", campaignCharacterIds)
      : Promise.resolve({ data: [], error: null }),
    campaignCharacterIds.length
      ? db
          .from("damage_logs")
          .select("*")
          .in("campaign_character_id", campaignCharacterIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    campaignCharacterIds.length
      ? db
          .from("effect_logs")
          .select("*")
          .in("campaign_character_id", campaignCharacterIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const campaignCardLinks = (assertDb(
    campaignCardLinksRaw as { data: unknown; error: { message: string } | null },
    "Falha ao carregar cartas de campanha.",
  ) ?? []) as Array<Record<string, unknown>>;
  const damageLogs = (assertDb(
    damageLogsRaw as { data: unknown; error: { message: string } | null },
    "Falha ao carregar logs de dano de campanha.",
  ) ?? []) as Array<Record<string, unknown>>;
  const effectLogs = (assertDb(
    effectLogsRaw as { data: unknown; error: { message: string } | null },
    "Falha ao carregar logs de efeito de campanha.",
  ) ?? []) as Array<Record<string, unknown>>;

  const linksByCharacter = new Map<string, Array<Record<string, unknown>>>();
  for (const link of campaignCardLinks) {
    const id = String(link.campaign_character_id);
    const collection = linksByCharacter.get(id) ?? [];
    collection.push({
      ...link,
      card: (link.card as Record<string, unknown>) ?? {},
    });
    linksByCharacter.set(id, collection);
  }

  const damageByCharacter = new Map<string, Array<Record<string, unknown>>>();
  for (const log of damageLogs) {
    const id = String(log.campaign_character_id);
    const collection = damageByCharacter.get(id) ?? [];
    if (collection.length < 20) {
      collection.push(log);
      damageByCharacter.set(id, collection);
    }
  }

  const effectByCharacter = new Map<string, Array<Record<string, unknown>>>();
  for (const log of effectLogs) {
    const id = String(log.campaign_character_id);
    const collection = effectByCharacter.get(id) ?? [];
    if (collection.length < 8) {
      collection.push(log);
      effectByCharacter.set(id, collection);
    }
  }

  const normalizedCampaignCharacters: MasterCharacterDetail[] = campaignCharacters.map((row) => {
    const id = String(row.id);
    const player = (row.player as Record<string, unknown> | null) ?? null;
    const parsed = parseCharacterDetail({
      ...row,
      cards: linksByCharacter.get(id) ?? [],
      damageLogs: damageByCharacter.get(id) ?? [],
      effectLogs: effectByCharacter.get(id) ?? [],
    });

    return {
      ...parsed,
      campaignCharacterId: id,
      campaignId: String(row.campaign_id),
      baseCharacterId: (row.base_character_id as string | null | undefined) ?? null,
      playerId: String(row.player_id),
      playerName: player?.display_name ? String(player.display_name) : "Jogador",
    };
  });

  return {
    campaigns,
    users: normalizedUsers,
    usersByCampaign: Object.fromEntries(memberUsersByCampaign),
    characters: normalizedCampaignCharacters,
    cards: cards.map((row) => parseCard(row)),
  };
}

export async function getImportDashboard() {
  const [countResult, cardsResult] = await Promise.all([
    db.from("cards").select("*", { count: "exact", head: true }),
    db.from("cards").select("*").order("updated_at", { ascending: false }).limit(20),
  ]);

  const count = countResult.count ?? 0;
  const cards = (assertDb(cardsResult, "Falha ao carregar cartas recentes.") ??
    []) as Array<Record<string, unknown>>;

  return {
    count,
    cards: cards.map(parseCard),
  };
}
