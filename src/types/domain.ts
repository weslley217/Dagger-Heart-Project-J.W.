export type UserRole = "PLAYER" | "MASTER";

export type CampaignStatus = "draft" | "open" | "active" | "archived";

export type CampaignRestrictions = {
  startingLevel: number;
  specialAbilities: string[];
  bonusCards: string[];
  customRules: string;
};

export type AppUserSummary = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
};

export type CampaignSummary = {
  id: string;
  name: string;
  description?: string | null;
  status: CampaignStatus;
  isOpen: boolean;
  startLevel: number;
  restrictions: CampaignRestrictions;
  specialRules?: string | null;
  createdAt: string;
  memberCount: number;
  myRole?: "MASTER" | "PLAYER";
};

export type CampaignCharacterSummary = CharacterSummary & {
  campaignCharacterId: string;
  campaignId: string;
  baseCharacterId?: string | null;
  playerId: string;
  playerName: string;
};

export type MasterCharacterDetail = CharacterDetail & {
  campaignCharacterId: string;
  campaignId: string;
  baseCharacterId?: string | null;
  playerId: string;
  playerName: string;
};

export type DomainKey =
  | "arcano"
  | "codice"
  | "esplendor"
  | "falange"
  | "graca"
  | "lamina"
  | "meia-noite"
  | "sabedoria"
  | "valor";

export type CardCategory =
  | "classe"
  | "subclasse"
  | "dominio"
  | "comunidade"
  | "ancestralidade"
  | "outros";

export type CharacterAttributes = {
  agility: number;
  strength: number;
  finesse: number;
  instinct: number;
  presence: number;
  knowledge: number;
};

export type CharacterProficiencies = {
  proficiency: number;
  experiences: Array<{ label: string; bonus: number }>;
};

export type CharacterResources = {
  hope: number;
  hopeMax: number;
  fatigue: number;
  fatigueMax: number;
  gold: number;
  stress: number;
  stressMax: number;
  notes?: string;
};

export type EquipmentWeapon = {
  name: string;
  attribute: string;
  range: string;
  damage: string;
  hands: string;
  type: "physical" | "magical" | "secondary";
  ability?: string;
};

export type EquipmentArmor = {
  name: string;
  baseThresholds: [number, number];
  baseArmor: number;
  ability?: string;
};

export type CharacterEquipment = {
  primaryWeapon?: EquipmentWeapon | null;
  secondaryWeapon?: EquipmentWeapon | null;
  armor?: EquipmentArmor | null;
  inventory: string[];
};

export type CardEffect =
  | {
      type: "grant_resource";
      resource: "hope" | "fatigue" | "armor" | "stress";
      amount: number;
      mode?: "gain" | "recover";
    }
  | {
      type: "heal_hp";
      amount: number;
    }
  | {
      type: "apply_condition";
      condition: string;
      temporary?: boolean;
    }
  | {
      type: "modify_thresholds";
      amount: number;
    }
  | {
      type: "modify_damage";
      amount: number;
      reason?: string;
    }
  | {
      type: "uses_per_rest";
      uses: number;
    }
  | {
      type: "custom_handler";
      handler: string;
    };

export type CardSummary = {
  id: string;
  name: string;
  category: CardCategory;
  type?: string | null;
  classKey?: string | null;
  subclassKey?: string | null;
  domainKey?: string | null;
  tier?: string | null;
  text: string;
  keywords: string[];
  imageUrl?: string | null;
  sourcePdfKey?: string | null;
  sourcePage?: number | null;
  effects: CardEffect[];
  customHandler?: string | null;
  tagKey?: string | null;
};

export type CharacterCardSummary = CardSummary & {
  linkId: string;
  status: string;
  usesMax?: number | null;
  usesCurrent?: number | null;
  cooldown?: string | null;
  notes?: string | null;
};

export type DamageLogSummary = {
  id: string;
  damageRaw: number;
  damagePoints: number;
  armorUsed: boolean;
  armorBefore: number;
  armorAfter: number;
  hpBefore: number;
  hpAfter: number;
  downed: boolean;
  createdAt: string;
  undoneAt?: string | null;
};

export type EffectLogSummary = {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
};

export type CharacterSummary = {
  id: string;
  name: string;
  level: number;
  shortDescription: string;
  classKey: string;
  subclassKey: string;
  ancestryKey: string;
  communityKey: string;
  totalHp: number;
  currentHp: number;
  armorMax: number;
  armorCurrent: number;
  threshold1: number;
  threshold2: number;
  evasion: number;
  isDowned: boolean;
  conditions: string[];
  resources: CharacterResources;
  druidForms?: string[];
  equipment?: CharacterEquipment;
};

export type CharacterDetail = CharacterSummary & {
  domains: DomainKey[];
  attributes: CharacterAttributes;
  proficiencies: CharacterProficiencies;
  notes?: string | null;
  druidForms: string[];
  equipment: CharacterEquipment;
  cards: CharacterCardSummary[];
  damageLogs: DamageLogSummary[];
  effectLogs: EffectLogSummary[];
};

export type ImportCardInput = {
  id: string;
  name: string;
  category: CardCategory;
  type?: string | null;
  classKey?: string | null;
  subclassKey?: string | null;
  domainKey?: string | null;
  tier?: string | null;
  text: string;
  keywords?: string[];
  imageUrl?: string | null;
  sourcePdfKey?: string | null;
  sourcePage?: number | null;
  effects?: CardEffect[];
  customHandler?: string | null;
};
