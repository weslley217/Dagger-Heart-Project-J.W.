import sourceData from "../../daggerheart_criacao_personagem.json";

import type {
  CardCategory,
  CharacterEquipment,
  DomainKey,
  EquipmentArmor,
  EquipmentWeapon,
} from "@/types/domain";
import { slugify } from "@/lib/utils";

export type ReferenceClass = {
  key: string;
  label: string;
  description: string;
  domains: DomainKey[];
  initialHp: number;
  initialEvasion: number;
  suggestedArmor: number;
  suggestedThreshold1: number;
  suggestedThreshold2: number;
  subclasses: Array<{
    key: string;
    label: string;
    summary: string;
    spellcastingTrait?: string;
  }>;
};

type SourceClass = {
  name: string;
  domains: string[];
  starting_evasion: number;
  starting_hp: number;
  class_features?: Array<{ name?: string; effect?: string }>;
  subclasses?: Array<{
    name: string;
    conjuration_attribute?: string;
    fundamental?: string[];
    specialization?: string[];
    mastery?: string[];
  }>;
};
type SourceSubclass = NonNullable<SourceClass["subclasses"]>[number];

type SourceListItem = {
  name: string;
};

type SourceEquipmentWeapon = {
  name: string;
  attribute: string;
  range: string;
  damage: string;
  hands: string;
  ability?: string;
};

type SourceEquipmentArmor = {
  name: string;
  base_thresholds: number[];
  base_armor: number;
  ability?: string;
};

const validDomainKeys: DomainKey[] = [
  "arcano",
  "codice",
  "esplendor",
  "falange",
  "graca",
  "lamina",
  "meia-noite",
  "sabedoria",
  "valor",
];

const domainKeySet = new Set(validDomainKeys);

const baselineByClassKey: Record<string, { armor: number; threshold1: number; threshold2: number }> =
  {
    bardo: { armor: 2, threshold1: 6, threshold2: 12 },
    druida: { armor: 3, threshold1: 7, threshold2: 14 },
    feiticeiro: { armor: 3, threshold1: 6, threshold2: 13 },
    guardiao: { armor: 4, threshold1: 8, threshold2: 16 },
    guerreiro: { armor: 3, threshold1: 7, threshold2: 15 },
    ladino: { armor: 2, threshold1: 6, threshold2: 12 },
    mago: { armor: 2, threshold1: 5, threshold2: 11 },
    patrulheiro: { armor: 3, threshold1: 7, threshold2: 14 },
    serafim: { armor: 4, threshold1: 8, threshold2: 16 },
  };

function asDomainKey(label: string): DomainKey {
  const key = slugify(label) as DomainKey;
  if (!domainKeySet.has(key)) {
    throw new Error(`Domínio não mapeado no livro: ${label}`);
  }
  return key;
}

function summarizeSubclass(subclass: SourceSubclass) {
  return (
    subclass.fundamental?.[0] ??
    subclass.specialization?.[0] ??
    subclass.mastery?.[0] ??
    "Subclasse pronta para uso em campanha."
  );
}

const sourceClasses = sourceData.classes as SourceClass[];
const sourceAncestries = sourceData.ancestries as SourceListItem[];
const sourceCommunities = sourceData.communities as SourceListItem[];
const sourceDomains = sourceData.domains as Array<{ name: string }>;
const sourceStartingEquipment = sourceData.starting_equipment as unknown as {
  primary_weapons_tier_1: {
    physical: SourceEquipmentWeapon[];
    magical: SourceEquipmentWeapon[];
  };
  secondary_weapons_tier_1: SourceEquipmentWeapon[];
  armors_tier_1: SourceEquipmentArmor[];
};
const sourceEquipmentRules = sourceData.equipment_rules as {
  weapon_selection: { summary: string; proficiency_rule: string };
  armor_selection: { summary: string; damage_reduction_rule: string };
  default_inventory: string[];
};

export const sheetDefaults = {
  startingLevel: sourceData.sheet_defaults.starting_level,
  startingProficiency: sourceData.sheet_defaults.starting_proficiency,
  startingHope: sourceData.sheet_defaults.starting_hope,
  maxHope: sourceData.sheet_defaults.max_hope,
  startingFatigue: sourceData.sheet_defaults.starting_fatigue_by_default,
  attributeModifiers: sourceData.sheet_defaults.attribute_modifiers_to_assign,
};

export const domains: Array<{ key: DomainKey; label: string }> = sourceDomains.map((item) => ({
  key: asDomainKey(item.name),
  label: item.name,
}));

export const classes: ReferenceClass[] = sourceClasses.map((sourceClass) => {
  const key = slugify(sourceClass.name);
  const baseline = baselineByClassKey[key] ?? {
    armor: 3,
    threshold1: 7,
    threshold2: 14,
  };

  const features = sourceClass.class_features ?? [];
  const description =
    features.map((feature) => feature.effect?.trim()).find(Boolean) ??
    `${sourceClass.name} com foco em ${sourceClass.domains.join(" e ")}.`;

  return {
    key,
    label: sourceClass.name,
    description,
    domains: sourceClass.domains.map(asDomainKey),
    initialHp: sourceClass.starting_hp,
    initialEvasion: sourceClass.starting_evasion,
    suggestedArmor: baseline.armor,
    suggestedThreshold1: baseline.threshold1,
    suggestedThreshold2: baseline.threshold2,
    subclasses:
      sourceClass.subclasses?.map((subclass) => ({
        key: slugify(subclass.name),
        label: subclass.name,
        summary: summarizeSubclass(subclass),
        spellcastingTrait: subclass.conjuration_attribute,
      })) ?? [],
  };
});

export const ancestries = [
  ...sourceAncestries.map((item) => item.name),
  "Ancestralidade Mista",
] as const;

export const communities = sourceCommunities.map((item) => item.name) as readonly string[];

export const equipmentRules = sourceEquipmentRules;

export const primaryWeaponsTier1: EquipmentWeapon[] = [
  ...sourceStartingEquipment.primary_weapons_tier_1.physical.map((item) => ({
    name: item.name,
    attribute: item.attribute,
    range: item.range,
    damage: item.damage,
    hands: item.hands,
    type: "physical" as const,
    ability: item.ability,
  })),
  ...sourceStartingEquipment.primary_weapons_tier_1.magical.map((item) => ({
    name: item.name,
    attribute: item.attribute,
    range: item.range,
    damage: item.damage,
    hands: item.hands,
    type: "magical" as const,
    ability: item.ability,
  })),
];

export const secondaryWeaponsTier1: EquipmentWeapon[] =
  sourceStartingEquipment.secondary_weapons_tier_1.map((item) => ({
    name: item.name,
    attribute: item.attribute,
    range: item.range,
    damage: item.damage,
    hands: item.hands,
    type: "secondary" as const,
    ability: item.ability,
  }));

export const armorsTier1: EquipmentArmor[] = sourceStartingEquipment.armors_tier_1.map(
  (item) => {
    const baseThresholds: [number, number] = [
      Number(item.base_thresholds[0] ?? 7),
      Number(item.base_thresholds[1] ?? 14),
    ];

    return {
      name: item.name,
      baseThresholds,
      baseArmor: item.base_armor,
      ability: item.ability,
    };
  },
);

export function createDefaultEquipment(): CharacterEquipment {
  return {
    primaryWeapon: null,
    secondaryWeapon: null,
    armor: null,
    inventory: [...equipmentRules.default_inventory],
  };
}

export const commonConditions = [
  "Vulnerável",
  "Imobilizado",
  "Oculto",
  "Priorizado",
  "Atordoado",
  "Voando",
  "Marcado",
  "Determinado",
] as const;

export const categoryLabels: Record<CardCategory, string> = {
  classe: "Classe",
  subclasse: "Subclasse",
  dominio: "Domínio",
  comunidade: "Comunidade",
  ancestralidade: "Ancestralidade",
  outros: "Outros",
};

export function getClassReference(classKey: string) {
  return classes.find((item) => item.key === classKey);
}

export function getSubclassReference(subclassKey: string) {
  return classes
    .flatMap((item) =>
      item.subclasses.map((subclass) => ({
        ...subclass,
        classKey: item.key,
        classLabel: item.label,
      })),
    )
    .find((item) => item.key === subclassKey);
}

export function getAncestryLabelByKey(ancestryKey: string) {
  return ancestries.find((item) => slugify(item) === ancestryKey) ?? ancestryKey;
}

export function getCommunityLabelByKey(communityKey: string) {
  return communities.find((item) => slugify(item) === communityKey) ?? communityKey;
}
