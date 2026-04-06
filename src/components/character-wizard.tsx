"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Shield,
  Sparkles,
  Sword,
  User,
  WandSparkles,
} from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { CardPageCanvas } from "@/components/ui/card-page-canvas";
import { emitLiveRefresh } from "@/hooks/use-live-refresh";
import {
  ancestries,
  armorsTier1,
  categoryLabels,
  classes,
  communities,
  createDefaultEquipment,
  domains as referenceDomains,
  equipmentRules,
  primaryWeaponsTier1,
  secondaryWeaponsTier1,
  sheetDefaults,
} from "@/lib/reference-data";
import { slugify } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type {
  CampaignSummary,
  CardSummary,
  CharacterEquipment,
  EquipmentArmor,
  EquipmentWeapon,
} from "@/types/domain";

type CharacterWizardProps = {
  availableCards: CardSummary[];
  campaigns?: CampaignSummary[];
};

type Experience = { label: string; bonus: number };

type ItemModalState =
  | { slot: "primaryWeapon"; title: string }
  | { slot: "secondaryWeapon"; title: string }
  | { slot: "armor"; title: string }
  | null;

type ItemTier = "tier1" | "tier2_4" | "tier5_7" | "tier8_10";
type ItemTypeFilter = "all" | "physical" | "magical";
type WizardTab = "basico" | "atributos" | "itens" | "cartas" | "resumo";

const TABS: { key: WizardTab; label: string; icon: React.ElementType }[] = [
  { key: "basico", label: "Básico", icon: User },
  { key: "atributos", label: "Atributos", icon: Sparkles },
  { key: "itens", label: "Itens", icon: Sword },
  { key: "cartas", label: "Domínios", icon: WandSparkles },
  { key: "resumo", label: "Resumo", icon: Shield },
];

const itemTierOptions: Array<{ key: ItemTier; label: string }> = [
  { key: "tier1", label: "Tier 1" },
  { key: "tier2_4", label: "Tier 2-4" },
  { key: "tier5_7", label: "Tier 5-7" },
  { key: "tier8_10", label: "Tier 8-10" },
];

const PRIMARY_WEAPONS_BY_TIER: Record<ItemTier, EquipmentWeapon[]> = {
  tier1: primaryWeaponsTier1,
  tier2_4: [],
  tier5_7: [],
  tier8_10: [],
};

const SECONDARY_WEAPONS_BY_TIER: Record<ItemTier, EquipmentWeapon[]> = {
  tier1: secondaryWeaponsTier1,
  tier2_4: [],
  tier5_7: [],
  tier8_10: [],
};

const ARMORS_BY_TIER: Record<ItemTier, EquipmentArmor[]> = {
  tier1: armorsTier1,
  tier2_4: [],
  tier5_7: [],
  tier8_10: [],
};

const attributeMeta = [
  { key: "agility", label: "Agilidade" },
  { key: "strength", label: "Força" },
  { key: "finesse", label: "Acuidade" },
  { key: "instinct", label: "Instinto" },
  { key: "presence", label: "Presença" },
  { key: "knowledge", label: "Conhecimento" },
] as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function armorThresholdWithLevel(base: number, level: number) {
  return base + Math.max(1, level);
}

function equipmentText(item: EquipmentWeapon | EquipmentArmor) {
  if ("baseArmor" in item) {
    return `Armadura base ${item.baseArmor} | Limiar ${item.baseThresholds[0]}/${item.baseThresholds[1]}`;
  }
  return `${item.attribute} | ${item.range} | ${item.hands} | ${item.damage}`;
}

// ─── Visual card component used inside the domain tab ────────────────────────
function DomainCardVisual({
  card,
  selected,
  disabled,
  onToggle,
  domainLabel,
}: {
  card: CardSummary;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  domainLabel: string;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
        selected
          ? "border-[var(--accent)] shadow-[0_0_18px_rgba(213,177,106,0.25)]"
          : "border-white/10 hover:border-white/25"
      } ${disabled ? "opacity-40" : "cursor-pointer"}`}
      style={{ minHeight: 320 }}
      onClick={disabled ? undefined : onToggle}
    >
      {/* Card image / canvas preview */}
      <div className="relative flex-1 bg-black/30">
        {card.sourcePdfKey ? (
          <CardPageCanvas
            sourcePdfKey={card.sourcePdfKey}
            sourcePage={card.sourcePage ?? 1}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,rgba(212,177,106,0.12),transparent_60%)] p-5 text-center">
            <WandSparkles className="h-8 w-8 text-[var(--accent)]/50" />
            <p className="text-sm font-semibold leading-snug text-white/80">{card.name}</p>
            <p className="line-clamp-5 text-xs leading-6 text-white/50">{card.text}</p>
          </div>
        )}
        {/* Domain badge */}
        <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-white/70 backdrop-blur-sm">
          {domainLabel}
        </span>
        {card.tier ? (
          <span className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-[var(--accent)] backdrop-blur-sm">
            {card.tier}
          </span>
        ) : null}
      </div>

      {/* Card footer */}
      <div
        className={`flex items-center justify-between gap-2 border-t px-3 py-2.5 transition-colors ${
          selected ? "border-[var(--accent)]/30 bg-[rgba(213,177,106,0.12)]" : "border-white/8 bg-black/40"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{card.name}</p>
        </div>
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition ${
            selected ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-white/30 text-white/0"
          }`}
        >
          <Check className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}

// ─── Automatic card chip used in the Domínios tab ────────────────────────────
function AutoCardChip({ card }: { card: CardSummary }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <button
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{card.name}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-white/40">
            {categoryLabels[card.category]}
            {card.tier ? ` · ${card.tier}` : ""}
          </p>
        </div>
        <ChevronRight
          className={`mt-0.5 h-4 w-4 shrink-0 text-white/40 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-6 text-white/60">{card.text}</p>
          {card.sourcePdfKey ? (
            <CardPageCanvas
              sourcePdfKey={card.sourcePdfKey}
              sourcePage={card.sourcePage ?? 1}
              className="rounded-xl border border-white/10"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Main wizard component ────────────────────────────────────────────────────
export function CharacterWizard({ availableCards, campaigns = [] }: CharacterWizardProps) {
  const router = useRouter();
  const { setPlayerTab } = useUiStore();
  const classFallback = classes[0];

  // ── tab navigation
  const [activeTab, setActiveTab] = useState<WizardTab>("basico");

  // ── basic fields
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [classKey, setClassKey] = useState(classFallback?.key ?? "");
  const [subclassKey, setSubclassKey] = useState(classFallback?.subclasses[0]?.key ?? "");
  const [level, setLevel] = useState(sheetDefaults.startingLevel);
  const [ancestryKey, setAncestryKey] = useState(slugify(ancestries[0] ?? "humano"));
  const [communityKey, setCommunityKey] = useState(slugify(communities[0] ?? "aristocratica"));

  // ── attributes
  const [attributes, setAttributes] = useState<Record<string, number>>({
    agility: sheetDefaults.attributeModifiers[0] ?? 2,
    strength: sheetDefaults.attributeModifiers[1] ?? 1,
    finesse: sheetDefaults.attributeModifiers[2] ?? 1,
    instinct: sheetDefaults.attributeModifiers[3] ?? 0,
    presence: sheetDefaults.attributeModifiers[4] ?? 0,
    knowledge: sheetDefaults.attributeModifiers[5] ?? -1,
  });

  const [proficiency, setProficiency] = useState(sheetDefaults.startingProficiency);
  const [experiences, setExperiences] = useState<Experience[]>([
    { label: "", bonus: 2 },
    { label: "", bonus: 2 },
  ]);
  const [hpBonus, setHpBonus] = useState(0);
  const [evasionBonus, setEvasionBonus] = useState(0);

  // ── resources
  const [hope, setHope] = useState(sheetDefaults.startingHope);
  const [hopeMax, setHopeMax] = useState(sheetDefaults.maxHope);
  const [fatigue, setFatigue] = useState(0);
  const [fatigueMax, setFatigueMax] = useState(sheetDefaults.startingFatigue);
  const [gold, setGold] = useState(0);
  const [stress, setStress] = useState(0);
  const [stressMax, setStressMax] = useState(6);

  // ── cards
  const [selectedDomainCardIds, setSelectedDomainCardIds] = useState<string[]>([]);
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [cardSearch, setCardSearch] = useState("");

  // ── misc
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [notes, setNotes] = useState("");
  const [druidFormsText, setDruidFormsText] = useState("");
  const [equipment, setEquipment] = useState<CharacterEquipment>(createDefaultEquipment());
  const [newInventoryItem, setNewInventoryItem] = useState("");
  const [itemModal, setItemModal] = useState<ItemModalState>(null);
  const [itemTier, setItemTier] = useState<ItemTier>("tier1");
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>("all");
  const [itemSearch, setItemSearch] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── derived
  const selectedClass = useMemo(
    () => classes.find((item) => item.key === classKey) ?? classFallback,
    [classFallback, classKey],
  );

  useEffect(() => {
    if (!selectedClass) return;
    const hasCurrent = selectedClass.subclasses.some((item) => item.key === subclassKey);
    if (!hasCurrent) setSubclassKey(selectedClass.subclasses[0]?.key ?? "");
    setSelectedDomainCardIds((current) => {
      const domainSet = new Set(selectedClass.domains);
      return current.filter((cardId) => {
        const card = availableCards.find((item) => item.id === cardId);
        return card?.domainKey ? domainSet.has(card.domainKey as (typeof selectedClass.domains)[number]) : false;
      });
    });
  }, [availableCards, selectedClass, subclassKey]);

  const domainMap = useMemo(
    () => Object.fromEntries(referenceDomains.map((item) => [item.key, item.label])) as Record<string, string>,
    [],
  );

  const selectedAncestryLabel = useMemo(
    () => ancestries.find((item) => slugify(item) === ancestryKey) ?? ancestryKey,
    [ancestryKey],
  );

  const selectedCommunityLabel = useMemo(
    () => communities.find((item) => slugify(item) === communityKey) ?? communityKey,
    [communityKey],
  );

  const automaticCards = useMemo(() => {
    if (!selectedClass || !subclassKey) return [];
    const normalizedAncestry = normalize(selectedAncestryLabel);
    const normalizedCommunity = normalize(selectedCommunityLabel);
    const cards = availableCards.filter((card) => {
      if (card.classKey && card.classKey === selectedClass.key) return true;
      if (card.subclassKey && card.subclassKey === subclassKey) return true;
      if (card.tagKey === `ancestry:${ancestryKey}` || card.tagKey === `community:${communityKey}`) return true;
      if (card.category === "ancestralidade") return normalize(card.name).includes(normalizedAncestry);
      if (card.category === "comunidade") return normalize(card.name).includes(normalizedCommunity);
      return false;
    });
    return cards
      .filter((card, index) => cards.findIndex((item) => item.id === card.id) === index)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ancestryKey, availableCards, communityKey, selectedAncestryLabel, selectedClass, selectedCommunityLabel, subclassKey]);

  const availableDomainCards = useMemo(() => {
    if (!selectedClass) return [];
    const selectedDomains = new Set(selectedClass.domains);
    const exactMatches = availableCards.filter(
      (card) => card.category === "dominio" && card.domainKey && selectedDomains.has(card.domainKey as (typeof selectedClass.domains)[number]),
    );
    if (exactMatches.length > 0) return exactMatches.sort((a, b) => a.name.localeCompare(b.name));
    const fallbackMatches = availableCards.filter((card) => {
      const normalized = normalize(`${card.name} ${card.text}`);
      return selectedClass.domains.some((domainKey) => {
        const label = domainMap[domainKey] ?? domainKey;
        return normalized.includes(normalize(label));
      });
    });
    return fallbackMatches
      .filter((card, index) => fallbackMatches.findIndex((item) => item.id === card.id) === index)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [availableCards, domainMap, selectedClass]);

  // Available domains from the current class's cards (for the filter dropdown)
  const availableDomainsForFilter = useMemo(() => {
    const keys = new Set<string>();
    availableDomainCards.forEach((c) => { if (c.domainKey) keys.add(c.domainKey); });
    return Array.from(keys);
  }, [availableDomainCards]);

  // Available tiers for the filter dropdown
  const availableTiersForFilter = useMemo(() => {
    const tiers = new Set<string>();
    availableDomainCards.forEach((c) => { if (c.tier) tiers.add(c.tier); });
    return Array.from(tiers).sort();
  }, [availableDomainCards]);

  const filteredDomainCards = useMemo(() => {
    const q = normalize(cardSearch);
    return availableDomainCards.filter((card) => {
      if (domainFilter !== "all" && card.domainKey !== domainFilter) return false;
      if (tierFilter !== "all" && card.tier !== tierFilter) return false;
      if (q && !normalize(`${card.name} ${card.text}`).includes(q)) return false;
      return true;
    });
  }, [availableDomainCards, domainFilter, tierFilter, cardSearch]);

  const totalHp = Math.max(1, (selectedClass?.initialHp ?? 6) + hpBonus);
  const evasion = Math.max(1, (selectedClass?.initialEvasion ?? 10) + evasionBonus);
  const armorMax = equipment.armor?.baseArmor ?? selectedClass?.suggestedArmor ?? 3;
  const threshold1 = armorThresholdWithLevel(
    equipment.armor?.baseThresholds[0] ?? selectedClass?.suggestedThreshold1 ?? 7,
    level,
  );
  const threshold2 = armorThresholdWithLevel(
    equipment.armor?.baseThresholds[1] ?? selectedClass?.suggestedThreshold2 ?? 14,
    level,
  );

  function toggleDomainCard(cardId: string) {
    setSelectedDomainCardIds((current) => {
      if (current.includes(cardId)) return current.filter((item) => item !== cardId);
      if (current.length >= 2) return current;
      return [...current, cardId];
    });
  }

  function setAttribute(attributeKey: string, value: number) {
    setAttributes((current) => ({ ...current, [attributeKey]: value }));
  }

  function updateExperience(index: number, patch: Partial<Experience>) {
    setExperiences((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function addExperience() {
    setExperiences((current) => [...current, { label: "", bonus: 2 }]);
  }

  function removeExperience(index: number) {
    setExperiences((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function pickItem(item: EquipmentWeapon | EquipmentArmor) {
    setEquipment((current) => {
      if (itemModal?.slot === "armor" && "baseArmor" in item) return { ...current, armor: item };
      if (itemModal?.slot === "primaryWeapon" && !("baseArmor" in item)) return { ...current, primaryWeapon: item };
      if (itemModal?.slot === "secondaryWeapon" && !("baseArmor" in item)) return { ...current, secondaryWeapon: item };
      return current;
    });
    setItemModal(null);
  }

  function addInventoryItem() {
    const item = newInventoryItem.trim();
    if (!item) return;
    setEquipment((current) => ({ ...current, inventory: [...current.inventory, item] }));
    setNewInventoryItem("");
  }

  function removeInventoryItem(item: string) {
    setEquipment((current) => ({
      ...current,
      inventory: current.inventory.filter((entry) => entry !== item),
    }));
  }

  function openItemModal(slot: "primaryWeapon" | "secondaryWeapon" | "armor", title: string) {
    setItemModal({ slot, title });
    setItemTier("tier1");
    setItemTypeFilter("all");
    setItemSearch("");
  }

  const filteredPrimaryPhysical = useMemo(() => {
    const query = normalize(itemSearch);
    return PRIMARY_WEAPONS_BY_TIER[itemTier].filter((item) => {
      if (item.type !== "physical") return false;
      if (!query) return true;
      return normalize(`${item.name} ${equipmentText(item)} ${item.ability ?? ""}`).includes(query);
    });
  }, [itemSearch, itemTier]);

  const filteredPrimaryMagical = useMemo(() => {
    const query = normalize(itemSearch);
    return PRIMARY_WEAPONS_BY_TIER[itemTier].filter((item) => {
      if (item.type !== "magical") return false;
      if (!query) return true;
      return normalize(`${item.name} ${equipmentText(item)} ${item.ability ?? ""}`).includes(query);
    });
  }, [itemSearch, itemTier]);

  const filteredSecondary = useMemo(() => {
    const query = normalize(itemSearch);
    return SECONDARY_WEAPONS_BY_TIER[itemTier].filter((item) => {
      if (!query) return true;
      return normalize(`${item.name} ${equipmentText(item)} ${item.ability ?? ""}`).includes(query);
    });
  }, [itemSearch, itemTier]);

  const filteredArmor = useMemo(() => {
    const query = normalize(itemSearch);
    return ARMORS_BY_TIER[itemTier].filter((item) => {
      if (!query) return true;
      return normalize(`${item.name} ${equipmentText(item)} ${item.ability ?? ""}`).includes(query);
    });
  }, [itemSearch, itemTier]);

  async function createCharacter() {
    try {
      setError(null);
      setSuccess(null);

      if (!name.trim()) throw new Error("Informe o nome do personagem.");
      if (!selectedClass || !subclassKey) throw new Error("Selecione classe e subclasse.");

      setSubmitting(true);

      const response = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          level,
          shortDescription: shortDescription.trim() || "Sem descricao.",
          classKey: selectedClass.key,
          subclassKey,
          ancestryKey,
          communityKey,
          domains: selectedClass.domains,
          attributes,
          proficiencies: {
            proficiency,
            experiences: experiences
              .filter((item) => item.label.trim().length > 0)
              .map((item) => ({ label: item.label.trim(), bonus: item.bonus })),
          },
          totalHp,
          armorMax,
          threshold1,
          threshold2,
          evasion,
          resources: { hope, hopeMax, fatigue, fatigueMax, gold, stress, stressMax },
          selectedCardIds: selectedDomainCardIds,
          notes: notes.trim() || null,
          druidForms: druidFormsText.split("\n").map((item) => item.trim()).filter(Boolean),
          equipment,
          campaignId: selectedCampaignId || undefined,
        }),
      });

      const data = (await response.json()) as { error?: string; id?: string; campaignCharacterId?: string | null };

      if (!response.ok || !data.id) throw new Error(data.error ?? "Nao foi possivel criar o personagem.");

      emitLiveRefresh("create-character");
      if (selectedCampaignId && data.campaignCharacterId) {
        router.push(`/player/campaigns/${selectedCampaignId}/characters/${data.campaignCharacterId}`);
      } else {
        router.push(`/player/characters/${data.id}`);
      }
      setPlayerTab("criados");
      setSuccess("Personagem criado com sucesso.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao criar personagem.");
    } finally {
      setSubmitting(false);
    }
  }

  const tabIndex = TABS.findIndex((t) => t.key === activeTab);
  const prevTab = TABS[tabIndex - 1];
  const nextTab = TABS[tabIndex + 1];

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0">
      {/* ── Tab bar ── */}
      <div className="sticky top-0 z-20 mb-4 overflow-x-auto rounded-2xl border border-white/8 bg-black/60 backdrop-blur-md">
        <div className="flex min-w-max">
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;
            const isDone = idx < tabIndex;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : isDone
                    ? "border-transparent text-white/60 hover:text-white/80"
                    : "border-transparent text-white/35 hover:text-white/55"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {isDone && (
                  <span className="hidden h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 sm:flex">
                    <Check className="h-2.5 w-2.5 text-emerald-400" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════ TAB: BÁSICO ══════════════════════ */}
      {activeTab === "basico" && (
        <SurfaceCard className="space-y-5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Dados básicos</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-white/55">Nome do personagem</span>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Carlos, a Lança do Horizonte"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-white/55">Descrição curta</span>
              <textarea
                className="field min-h-20 resize-y py-3"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Resumo rápido da origem e do estilo do personagem"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Classe</span>
              <select className="field" value={classKey} onChange={(e) => setClassKey(e.target.value)}>
                {classes.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Subclasse</span>
              <select className="field" value={subclassKey} onChange={(e) => setSubclassKey(e.target.value)} disabled={!selectedClass?.subclasses.length}>
                {selectedClass?.subclasses.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Ancestralidade</span>
              <select className="field" value={ancestryKey} onChange={(e) => setAncestryKey(e.target.value)}>
                {ancestries.map((item) => {
                  const key = slugify(item);
                  return <option key={key} value={key}>{item}</option>;
                })}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Comunidade</span>
              <select className="field" value={communityKey} onChange={(e) => setCommunityKey(e.target.value)}>
                {communities.map((item) => {
                  const key = slugify(item);
                  return <option key={key} value={key}>{item}</option>;
                })}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Nível</span>
              <input
                type="number"
                min={1}
                max={10}
                className="field"
                value={level}
                onChange={(e) => setLevel(Math.max(1, Number(e.target.value || 1)))}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Campanha (opcional)</span>
              <select className="field" value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)}>
                <option value="">Somente ficha base</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.isOpen ? "(aberta)" : "(fechada)"}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Class info panel */}
          {selectedClass ? (
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Domínios da classe</p>
              <div className="flex flex-wrap gap-2">
                {selectedClass.domains.map((domainKey) => (
                  <span key={domainKey} className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium text-[var(--accent)]">
                    {domainMap[domainKey] ?? domainKey}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                {[
                  ["PV total", totalHp],
                  ["Evasão", evasion],
                  ["Armadura", armorMax],
                  ["Limiar", `${threshold1}/${threshold2}`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </SurfaceCard>
      )}

      {/* ══════════════════════ TAB: ATRIBUTOS ══════════════════════ */}
      {activeTab === "atributos" && (
        <div className="space-y-4">
          <SurfaceCard className="space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="text-lg font-semibold text-white">Atributos</h3>
            </div>

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              {attributeMeta.map((attr) => (
                <label key={attr.key} className="space-y-1">
                  <span className="text-xs text-white/55">{attr.label}</span>
                  <input
                    type="number"
                    className="field"
                    value={attributes[attr.key] ?? 0}
                    onChange={(e) => setAttribute(attr.key, Number(e.target.value || 0))}
                  />
                </label>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-white/55">Proficiência</span>
                <input
                  type="number"
                  min={0}
                  max={6}
                  className="field"
                  value={proficiency}
                  onChange={(e) => setProficiency(Math.max(0, Number(e.target.value || 0)))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-white/55">Bônus manual de HP</span>
                <input
                  type="number"
                  className="field"
                  value={hpBonus}
                  onChange={(e) => setHpBonus(Number(e.target.value || 0))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-white/55">Bônus manual de Evasão</span>
                <input
                  type="number"
                  className="field"
                  value={evasionBonus}
                  onChange={(e) => setEvasionBonus(Number(e.target.value || 0))}
                />
              </label>
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-5">
            <p className="text-sm font-semibold text-white">Recursos</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1"><span className="text-xs text-white/55">Esperança atual</span><input type="number" min={0} className="field" value={hope} onChange={(e) => setHope(Math.max(0, Number(e.target.value || 0)))} /></label>
              <label className="space-y-1"><span className="text-xs text-white/55">Esperança máxima</span><input type="number" min={1} className="field" value={hopeMax} onChange={(e) => setHopeMax(Math.max(1, Number(e.target.value || 1)))} /></label>
              <label className="space-y-1"><span className="text-xs text-white/55">Fadiga atual</span><input type="number" min={0} className="field" value={fatigue} onChange={(e) => setFatigue(Math.max(0, Number(e.target.value || 0)))} /></label>
              <label className="space-y-1"><span className="text-xs text-white/55">Fadiga máxima</span><input type="number" min={1} className="field" value={fatigueMax} onChange={(e) => setFatigueMax(Math.max(1, Number(e.target.value || 1)))} /></label>
              <label className="space-y-1"><span className="text-xs text-white/55">Estresse atual</span><input type="number" min={0} className="field" value={stress} onChange={(e) => setStress(Math.max(0, Number(e.target.value || 0)))} /></label>
              <label className="space-y-1"><span className="text-xs text-white/55">Estresse máximo</span><input type="number" min={1} className="field" value={stressMax} onChange={(e) => setStressMax(Math.max(1, Number(e.target.value || 1)))} /></label>
              <label className="space-y-1"><span className="text-xs text-white/55">Ouro</span><input type="number" min={0} className="field" value={gold} onChange={(e) => setGold(Math.max(0, Number(e.target.value || 0)))} /></label>
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Experiências</p>
              <Button variant="secondary" className="gap-2" onClick={addExperience}>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
            {experiences.map((item, index) => (
              <div key={`exp-${index}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <input
                  className="field"
                  value={item.label}
                  onChange={(e) => updateExperience(index, { label: e.target.value })}
                  placeholder="Ex.: Sobrevivente das Montanhas"
                />
                <input
                  type="number"
                  className="field"
                  value={item.bonus}
                  onChange={(e) => updateExperience(index, { bonus: Number(e.target.value || 0) })}
                />
                <Button variant="ghost" onClick={() => removeExperience(index)}>Remover</Button>
              </div>
            ))}
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <p className="text-sm font-semibold text-white">Anotações e formas druídicas</p>
            <label className="space-y-1">
              <span className="text-xs text-white/55">Anotações</span>
              <textarea
                className="field min-h-24 resize-y py-3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ligações, origem e observações relevantes"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-white/55">Formas druídicas (uma por linha)</span>
              <textarea
                className="field min-h-20 resize-y py-3"
                value={druidFormsText}
                onChange={(e) => setDruidFormsText(e.target.value)}
                placeholder={"Lobo da Lua\nCoruja Cinzenta"}
              />
            </label>
          </SurfaceCard>
        </div>
      )}

      {/* ══════════════════════ TAB: ITENS ══════════════════════ */}
      {activeTab === "itens" && (
        <SurfaceCard className="space-y-5">
          <div className="flex items-center gap-2">
            <Sword className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Itens do livro</h3>
          </div>
          <p className="text-sm text-white/60">{equipmentRules.weapon_selection.summary}</p>
          <p className="text-xs text-white/45">{equipmentRules.weapon_selection.proficiency_rule}</p>

          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                { slot: "primaryWeapon" as const, label: "Arma primária", item: equipment.primaryWeapon },
                { slot: "secondaryWeapon" as const, label: "Arma secundária", item: equipment.secondaryWeapon },
                { slot: "armor" as const, label: "Armadura", item: equipment.armor },
              ] as const
            ).map(({ slot, label, item }) => (
              <div key={slot} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">{label}</p>
                {item ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="text-xs text-white/55">{equipmentText(item)}</p>
                    {"ability" in item && item.ability ? (
                      <p className="text-xs text-[var(--accent)]">{item.ability}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-white/50">Nenhum selecionado.</p>
                )}
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => openItemModal(slot, `Selecionar ${label.toLowerCase()}`)}
                >
                  Escolher
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Inventário</p>
              <Button
                variant="ghost"
                onClick={() => setEquipment((c) => ({ ...c, inventory: [...equipmentRules.default_inventory] }))}
              >
                Restaurar padrão
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {equipment.inventory.map((item) => (
                <button
                  key={item}
                  className="rounded-full border border-white/12 bg-white/7 px-3 py-1 text-xs text-white/70 hover:border-rose-500/50 hover:text-rose-300 transition-colors"
                  onClick={() => removeInventoryItem(item)}
                  title="Clique para remover"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="field"
                value={newInventoryItem}
                onChange={(e) => setNewInventoryItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInventoryItem(); } }}
                placeholder="Adicionar item customizado"
              />
              <Button variant="secondary" onClick={addInventoryItem}>Adicionar</Button>
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* ══════════════════════ TAB: DOMÍNIOS ══════════════════════ */}
      {activeTab === "cartas" && (
        <div className="space-y-5">
          {/* Cartas automáticas */}
          <SurfaceCard className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <WandSparkles className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-base font-semibold text-white">Cartas automáticas</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs text-white/50">
                {automaticCards.length} carta{automaticCards.length !== 1 ? "s" : ""}
              </span>
            </div>

            {automaticCards.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {automaticCards.map((card) => (
                  <AutoCardChip key={card.id} card={card} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/50">
                Nenhuma carta automática encontrada. Importe as cartas de referência para preenchê-las.
              </p>
            )}
          </SurfaceCard>

          {/* Seleção de cartas de domínio */}
          <SurfaceCard className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="text-base font-semibold text-white">Cartas de domínio</h3>
                <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
                  {selectedDomainCardIds.length}/2
                </span>
              </div>
              <p className="text-xs text-white/45">Escolha até 2 cartas de domínio para o personagem</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <input
                className="field max-w-[200px] text-sm"
                placeholder="Buscar carta..."
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
              />
              <select
                className="field max-w-[160px] text-sm"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
              >
                <option value="all">Todos os domínios</option>
                {availableDomainsForFilter.map((key) => (
                  <option key={key} value={key}>{domainMap[key] ?? key}</option>
                ))}
              </select>
              <select
                className="field max-w-[140px] text-sm"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
              >
                <option value="all">Todos os tiers</option>
                {availableTiersForFilter.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Cards grid */}
            {filteredDomainCards.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredDomainCards.map((card) => {
                  const selected = selectedDomainCardIds.includes(card.id);
                  const disabled = !selected && selectedDomainCardIds.length >= 2;
                  return (
                    <DomainCardVisual
                      key={card.id}
                      card={card}
                      selected={selected}
                      disabled={disabled}
                      onToggle={() => toggleDomainCard(card.id)}
                      domainLabel={domainMap[card.domainKey ?? ""] ?? (card.domainKey ?? "—")}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white/50 py-4 text-center">
                {availableDomainCards.length === 0
                  ? "Nenhuma carta de domínio encontrada. Importe o baralho para preencher esta lista."
                  : "Nenhuma carta corresponde aos filtros selecionados."}
              </p>
            )}

            {/* Selected cards summary */}
            {selectedDomainCardIds.length > 0 && (
              <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]/70 mb-3">Cartas selecionadas</p>
                <div className="flex flex-wrap gap-2">
                  {selectedDomainCardIds.map((id) => {
                    const card = availableCards.find((c) => c.id === id);
                    return card ? (
                      <button
                        key={id}
                        onClick={() => toggleDomainCard(id)}
                        className="flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300 transition-colors"
                        title="Clique para remover"
                      >
                        {card.name}
                        <span className="opacity-50">×</span>
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* ══════════════════════ TAB: RESUMO ══════════════════════ */}
      {activeTab === "resumo" && (
        <div className="space-y-4">
          <SurfaceCard className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="text-lg font-semibold text-white">Resumo do personagem</h3>
            </div>

            {/* Identity */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40 mb-2">Identidade</p>
                <p className="text-base font-bold text-white">{name || "—"}</p>
                <p className="mt-1 text-xs text-white/50">{shortDescription || "Sem descrição"}</p>
                <p className="mt-2 text-xs text-[var(--accent)]">
                  {selectedClass?.label ?? "—"} · {selectedClass?.subclasses.find((s) => s.key === subclassKey)?.label ?? "—"} · Nível {level}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40 mb-2">Origem</p>
                <p className="text-sm text-white">{selectedAncestryLabel}</p>
                <p className="text-xs text-white/50 mt-0.5">{selectedCommunityLabel}</p>
              </div>
            </div>

            {/* Combat stats */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["PV", totalHp],
                ["Evasão", evasion],
                ["Armadura", armorMax],
                ["Limiar", `${threshold1}/${threshold2}`],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">{label}</p>
                  <p className="mt-1 text-xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Attributes */}
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/40 mb-2">Atributos</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {attributeMeta.map((attr) => (
                  <div key={attr.key} className="rounded-xl border border-white/8 bg-black/20 px-2 py-2 text-center">
                    <p className="text-[9px] uppercase tracking-widest text-white/40">{attr.label.substring(0, 3)}</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {(attributes[attr.key] ?? 0) >= 0 ? `+${attributes[attr.key] ?? 0}` : attributes[attr.key] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/40 mb-2">Equipamento</p>
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                {[
                  { label: "Arma primária", item: equipment.primaryWeapon },
                  { label: "Arma secundária", item: equipment.secondaryWeapon },
                  { label: "Armadura", item: equipment.armor },
                ].map(({ label, item }) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
                    <p className="text-white/40">{label}</p>
                    <p className="mt-1 font-semibold text-white">{item?.name ?? "Não selecionado"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Domain cards */}
            {selectedDomainCardIds.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/40 mb-2">Cartas de domínio selecionadas</p>
                <div className="flex flex-wrap gap-2">
                  {selectedDomainCardIds.map((id) => {
                    const card = availableCards.find((c) => c.id === id);
                    return card ? (
                      <span key={id} className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                        {card.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </SurfaceCard>

          {/* Create button */}
          <SurfaceCard className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Tudo pronto?</h3>
                <p className="text-sm text-white/55">Revise os dados acima e clique em Criar quando estiver pronto.</p>
              </div>
              <Button onClick={createCharacter} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                {submitting ? "Salvando..." : "Criar personagem"}
              </Button>
            </div>
            {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          </SurfaceCard>
        </div>
      )}

      {/* ── Tab navigation footer ── */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          {prevTab && (
            <Button variant="secondary" className="gap-2" onClick={() => setActiveTab(prevTab.key)}>
              <ChevronLeft className="h-4 w-4" />
              {prevTab.label}
            </Button>
          )}
        </div>
        <div>
          {nextTab && (
            <Button className="gap-2" onClick={() => setActiveTab(nextTab.key)}>
              {nextTab.label}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Item selection modal ── */}
      <Modal open={Boolean(itemModal)} title={itemModal?.title ?? "Selecionar item"} onClose={() => setItemModal(null)}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {itemTierOptions.map((tier) => (
              <button
                key={tier.key}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  itemTier === tier.key ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-white/6 text-white/65"
                }`}
                onClick={() => setItemTier(tier.key)}
              >
                {tier.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="field"
              placeholder="Buscar item por nome, atributo ou habilidade"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
            {itemModal?.slot === "primaryWeapon" ? (
              <div className="flex gap-2">
                {([ ["all", "Todos"], ["physical", "Físico"], ["magical", "Mágico"], ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      itemTypeFilter === key ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-white/6 text-white/65"
                    }`}
                    onClick={() => setItemTypeFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {itemModal?.slot === "primaryWeapon" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {(itemTypeFilter === "all" || itemTypeFilter === "physical") && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--accent)]">Físico</p>
                  <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
                    {filteredPrimaryPhysical.length ? (
                      filteredPrimaryPhysical.map((item) => (
                        <button key={item.name} className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-white/20" onClick={() => pickItem(item)}>
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-xs text-white/60">{equipmentText(item)}</p>
                          {item.ability ? <p className="mt-2 text-xs text-[var(--accent)]">{item.ability}</p> : null}
                        </button>
                      ))
                    ) : <p className="text-sm text-white/55">Sem itens para este tier/filtro.</p>}
                  </div>
                </div>
              )}
              {(itemTypeFilter === "all" || itemTypeFilter === "magical") && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--accent)]">Mágico</p>
                  <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
                    {filteredPrimaryMagical.length ? (
                      filteredPrimaryMagical.map((item) => (
                        <button key={item.name} className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-white/20" onClick={() => pickItem(item)}>
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-xs text-white/60">{equipmentText(item)}</p>
                          {item.ability ? <p className="mt-2 text-xs text-[var(--accent)]">{item.ability}</p> : null}
                        </button>
                      ))
                    ) : <p className="text-sm text-white/55">Sem itens para este tier/filtro.</p>}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {itemModal?.slot === "secondaryWeapon" ? (
            <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
              {filteredSecondary.length ? (
                filteredSecondary.map((item) => (
                  <button key={item.name} className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-white/20" onClick={() => pickItem(item)}>
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-xs text-white/60">{equipmentText(item)}</p>
                    {item.ability ? <p className="mt-2 text-xs text-[var(--accent)]">{item.ability}</p> : null}
                  </button>
                ))
              ) : <p className="text-sm text-white/55">Sem itens para este tier.</p>}
            </div>
          ) : null}

          {itemModal?.slot === "armor" ? (
            <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
              {filteredArmor.length ? (
                filteredArmor.map((item) => (
                  <button key={item.name} className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-white/20" onClick={() => pickItem(item)}>
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-xs text-white/60">{equipmentText(item)}</p>
                    {item.ability ? <p className="mt-2 text-xs text-[var(--accent)]">{item.ability}</p> : null}
                  </button>
                ))
              ) : <p className="text-sm text-white/55">Sem itens para este tier.</p>}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
