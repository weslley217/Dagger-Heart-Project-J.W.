import type {
  CardSummary,
  CharacterEquipment,
  CharacterDetail,
  CharacterProficiencies,
  CharacterResources,
  CharacterSummary,
} from "@/types/domain";
import { parseJson } from "@/lib/utils";

function pick<T = unknown>(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in row) {
      return row[key] as T;
    }
  }

  return undefined as T;
}

function toIso(value: unknown) {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(String(value)).toISOString();
}

export function parseCard(raw: Record<string, unknown>): CardSummary {
  return {
    id: String(pick(raw, "id")),
    name: String(pick(raw, "name")),
    category: String(pick(raw, "category")) as CardSummary["category"],
    type: (pick(raw, "type") as string | null | undefined) ?? null,
    classKey: (pick(raw, "classKey", "class_key") as string | null | undefined) ?? null,
    subclassKey:
      (pick(raw, "subclassKey", "subclass_key") as string | null | undefined) ?? null,
    domainKey: (pick(raw, "domainKey", "domain_key") as string | null | undefined) ?? null,
    tier: (pick(raw, "tier") as string | null | undefined) ?? null,
    text: String(pick(raw, "text")),
    keywords: parseJson<string[]>(pick(raw, "keywords"), []),
    imageUrl: (pick(raw, "imageUrl", "image_url") as string | null | undefined) ?? null,
    sourcePdfKey:
      (pick(raw, "sourcePdfKey", "source_pdf_key") as string | null | undefined) ?? null,
    sourcePage: (pick(raw, "sourcePage", "source_page") as number | null | undefined) ?? null,
    effects: parseJson(pick(raw, "effects"), []),
    customHandler:
      (pick(raw, "customHandler", "custom_handler") as string | null | undefined) ?? null,
    tagKey: (pick(raw, "tagKey", "tag_key") as string | null | undefined) ?? null,
  };
}

type RawCharacterRow = Record<string, unknown>;

export function parseCharacterSummary(raw: RawCharacterRow): CharacterSummary {
  return {
    id: String(pick(raw, "id")),
    name: String(pick(raw, "name")),
    level: Number(pick(raw, "level") ?? 1),
    shortDescription: String(pick(raw, "shortDescription", "short_description") ?? ""),
    classKey: String(pick(raw, "classKey", "class_key") ?? ""),
    subclassKey: String(pick(raw, "subclassKey", "subclass_key") ?? ""),
    ancestryKey: String(pick(raw, "ancestryKey", "ancestry_key") ?? ""),
    communityKey: String(pick(raw, "communityKey", "community_key") ?? ""),
    totalHp: Number(pick(raw, "totalHp", "total_hp") ?? 1),
    currentHp: Number(pick(raw, "currentHp", "current_hp") ?? 0),
    armorMax: Number(pick(raw, "armorMax", "armor_max") ?? 0),
    armorCurrent: Number(pick(raw, "armorCurrent", "armor_current") ?? 0),
    threshold1: Number(pick(raw, "threshold1") ?? 1),
    threshold2: Number(pick(raw, "threshold2") ?? 2),
    evasion: Number(pick(raw, "evasion") ?? 10),
    isDowned: Boolean(pick(raw, "isDowned", "is_downed")),
    conditions: parseJson<string[]>(pick(raw, "conditions"), []),
    resources: parseJson<CharacterResources>(pick(raw, "resources"), {
      hope: 2,
      hopeMax: 6,
      fatigue: 0,
      fatigueMax: 6,
      gold: 0,
      stress: 0,
      stressMax: 6,
    }),
    druidForms: parseJson<string[]>(pick(raw, "druidForms", "druid_forms"), []),
    equipment: parseJson<CharacterEquipment>(pick(raw, "equipment"), {
      primaryWeapon: null,
      secondaryWeapon: null,
      armor: null,
      inventory: [],
    }),
  };
}

export function parseCharacterDetail(
  raw: RawCharacterRow & {
    cards?: Array<
      Record<string, unknown> & {
        card?: Record<string, unknown>;
      }
    >;
    damageLogs?: Array<Record<string, unknown>>;
    effectLogs?: Array<Record<string, unknown>>;
  },
): CharacterDetail {
  const base = parseCharacterSummary(raw);

  return {
    ...base,
    domains: parseJson(pick(raw, "domains"), []),
    attributes: parseJson(pick(raw, "attributes"), {
      agility: 1,
      strength: 0,
      finesse: 1,
      instinct: 0,
      presence: 1,
      knowledge: 0,
    }),
    proficiencies: parseJson<CharacterProficiencies>(pick(raw, "proficiencies"), {
      proficiency: 1,
      experiences: [],
    }),
    notes: (pick(raw, "notes") as string | null | undefined) ?? null,
    druidForms: parseJson<string[]>(pick(raw, "druidForms", "druid_forms"), []),
    equipment: parseJson<CharacterEquipment>(pick(raw, "equipment"), {
      primaryWeapon: null,
      secondaryWeapon: null,
      armor: null,
      inventory: [],
    }),
    cards: (raw.cards ?? []).map((link) => ({
      ...parseCard((link.card as Record<string, unknown>) ?? link),
      linkId: String(pick(link, "id")),
      status: String(pick(link, "status") ?? "passiva"),
      usesMax: (pick(link, "usesMax", "uses_max") as number | null | undefined) ?? null,
      usesCurrent:
        (pick(link, "usesCurrent", "uses_current") as number | null | undefined) ?? null,
      cooldown: (pick(link, "cooldown") as string | null | undefined) ?? null,
      notes: (pick(link, "notes") as string | null | undefined) ?? null,
    })),
    damageLogs: (raw.damageLogs ?? []).map((log) => ({
      id: String(pick(log, "id")),
      damageRaw: Number(pick(log, "damageRaw", "damage_raw") ?? 0),
      damagePoints: Number(pick(log, "damagePoints", "damage_points") ?? 0),
      armorUsed: Boolean(pick(log, "armorUsed", "armor_used")),
      armorBefore: Number(pick(log, "armorBefore", "armor_before") ?? 0),
      armorAfter: Number(pick(log, "armorAfter", "armor_after") ?? 0),
      hpBefore: Number(pick(log, "hpBefore", "hp_before") ?? 0),
      hpAfter: Number(pick(log, "hpAfter", "hp_after") ?? 0),
      downed: Boolean(pick(log, "downed")),
      createdAt: toIso(pick(log, "createdAt", "created_at")),
      undoneAt: pick(log, "undoneAt", "undone_at")
        ? toIso(pick(log, "undoneAt", "undone_at"))
        : null,
    })),
    effectLogs: (raw.effectLogs ?? []).map((log) => ({
      id: String(pick(log, "id")),
      action: String(pick(log, "action") ?? ""),
      summary: String(pick(log, "summary") ?? ""),
      createdAt: toIso(pick(log, "createdAt", "created_at")),
    })),
  };
}
