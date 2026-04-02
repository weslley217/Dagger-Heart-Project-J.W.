"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Loader2, Plus, Shield, Sparkles, Sword, WandSparkles } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
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
  { key: "strength", label: "Forca" },
  { key: "finesse", label: "Acuidade" },
  { key: "instinct", label: "Instinto" },
  { key: "presence", label: "Presenca" },
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

export function CharacterWizard({ availableCards, campaigns = [] }: CharacterWizardProps) {
  const router = useRouter();
  const { setPlayerTab } = useUiStore();
  const classFallback = classes[0];

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [classKey, setClassKey] = useState(classFallback?.key ?? "");
  const [subclassKey, setSubclassKey] = useState(classFallback?.subclasses[0]?.key ?? "");
  const [level, setLevel] = useState(sheetDefaults.startingLevel);
  const [ancestryKey, setAncestryKey] = useState(slugify(ancestries[0] ?? "humano"));
  const [communityKey, setCommunityKey] = useState(slugify(communities[0] ?? "aristocratica"));

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
  const [hope, setHope] = useState(sheetDefaults.startingHope);
  const [hopeMax, setHopeMax] = useState(sheetDefaults.maxHope);
  const [fatigue, setFatigue] = useState(0);
  const [fatigueMax, setFatigueMax] = useState(sheetDefaults.startingFatigue);
  const [gold, setGold] = useState(0);
  const [stress, setStress] = useState(0);
  const [stressMax, setStressMax] = useState(6);

  const [selectedDomainCardIds, setSelectedDomainCardIds] = useState<string[]>([]);
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

  const selectedClass = useMemo(
    () => classes.find((item) => item.key === classKey) ?? classFallback,
    [classFallback, classKey],
  );

  useEffect(() => {
    if (!selectedClass) return;

    const hasCurrent = selectedClass.subclasses.some((item) => item.key === subclassKey);
    if (!hasCurrent) {
      setSubclassKey(selectedClass.subclasses[0]?.key ?? "");
    }

    setSelectedDomainCardIds((current) => {
      const domainSet = new Set(selectedClass.domains);
      return current.filter((cardId) => {
        const card = availableCards.find((item) => item.id === cardId);
        return card?.domainKey
          ? domainSet.has(card.domainKey as (typeof selectedClass.domains)[number])
          : false;
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
      if (card.tagKey === `ancestry:${ancestryKey}` || card.tagKey === `community:${communityKey}`) {
        return true;
      }
      if (card.category === "ancestralidade") {
        return normalize(card.name).includes(normalizedAncestry);
      }
      if (card.category === "comunidade") {
        return normalize(card.name).includes(normalizedCommunity);
      }
      return false;
    });

    return cards
      .filter((card, index) => cards.findIndex((item) => item.id === card.id) === index)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    ancestryKey,
    availableCards,
    communityKey,
    selectedAncestryLabel,
    selectedClass,
    selectedCommunityLabel,
    subclassKey,
  ]);

  const availableDomainCards = useMemo(() => {
    if (!selectedClass) return [];

    const selectedDomains = new Set(selectedClass.domains);
    const exactMatches = availableCards.filter(
      (card) =>
        card.category === "dominio" &&
        card.domainKey &&
        selectedDomains.has(card.domainKey as (typeof selectedClass.domains)[number]),
    );

    if (exactMatches.length > 0) {
      return exactMatches.sort((a, b) => a.name.localeCompare(b.name));
    }

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
      if (current.includes(cardId)) {
        return current.filter((item) => item !== cardId);
      }
      if (current.length >= 2) {
        return current;
      }
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
      if (itemModal?.slot === "armor" && "baseArmor" in item) {
        return { ...current, armor: item };
      }
      if (itemModal?.slot === "primaryWeapon" && !("baseArmor" in item)) {
        return { ...current, primaryWeapon: item };
      }
      if (itemModal?.slot === "secondaryWeapon" && !("baseArmor" in item)) {
        return { ...current, secondaryWeapon: item };
      }
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

  async function createCharacter() {
    try {
      setError(null);
      setSuccess(null);

      if (!name.trim()) {
        throw new Error("Informe o nome do personagem.");
      }
      if (!selectedClass || !subclassKey) {
        throw new Error("Selecione classe e subclasse.");
      }

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
          druidForms: druidFormsText
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          equipment,
          campaignId: selectedCampaignId || undefined,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        id?: string;
        campaignCharacterId?: string | null;
      };

      if (!response.ok || !data.id) {
        throw new Error(data.error ?? "Nao foi possivel criar o personagem.");
      }

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

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Dados basicos da ficha</h3>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-white/55">Nome do personagem</span>
              <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Carlos, a Lanca do Horizonte" />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-white/55">Descricao curta</span>
              <textarea className="field min-h-20 resize-y py-3" value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} placeholder="Resumo rapido da origem e do estilo do personagem" />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Classe</span>
              <select className="field" value={classKey} onChange={(event) => setClassKey(event.target.value)}>
                {classes.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Subclasse</span>
              <select className="field" value={subclassKey} onChange={(event) => setSubclassKey(event.target.value)} disabled={!selectedClass?.subclasses.length}>
                {selectedClass?.subclasses.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Ancestralidade</span>
              <select className="field" value={ancestryKey} onChange={(event) => setAncestryKey(event.target.value)}>
                {ancestries.map((item) => {
                  const key = slugify(item);
                  return <option key={key} value={key}>{item}</option>;
                })}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Comunidade</span>
              <select className="field" value={communityKey} onChange={(event) => setCommunityKey(event.target.value)}>
                {communities.map((item) => {
                  const key = slugify(item);
                  return <option key={key} value={key}>{item}</option>;
                })}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Nivel</span>
              <input type="number" min={1} max={10} className="field" value={level} onChange={(event) => setLevel(Math.max(1, Number(event.target.value || 1)))} />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Criar snapshot em campanha (opcional)</span>
              <select className="field" value={selectedCampaignId} onChange={(event) => setSelectedCampaignId(event.target.value)}>
                <option value="">Somente ficha base</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name} {campaign.isOpen ? "(aberta)" : "(fechada)"}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Bonus manual de HP</span>
              <input type="number" className="field" value={hpBonus} onChange={(event) => setHpBonus(Number(event.target.value || 0))} />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-white/55">Bonus manual de Evasao</span>
              <input type="number" className="field" value={evasionBonus} onChange={(event) => setEvasionBonus(Number(event.target.value || 0))} />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[ ["PV total", totalHp], ["Evasao", evasion], ["Armadura", armorMax], ["Limiar", `${threshold1}/${threshold2}`], ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-white/40">{label}</p>
                <p className="mt-2 text-xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          {selectedClass ? (
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Dominios da classe</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedClass.domains.map((domainKey) => (
                  <span key={domainKey} className="rounded-full border border-white/12 bg-white/7 px-3 py-1 text-xs text-white/70">{domainMap[domainKey] ?? domainKey}</span>
                ))}
              </div>
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold text-white">Atributos, recursos e notas</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {attributeMeta.map((attribute) => (
              <label key={attribute.key} className="space-y-1">
                <span className="text-xs text-white/55">{attribute.label}</span>
                <input type="number" className="field" value={attributes[attribute.key] ?? 0} onChange={(event) => setAttribute(attribute.key, Number(event.target.value || 0))} />
              </label>
            ))}
          </div>

          <label className="space-y-1">
            <span className="text-xs text-white/55">Proficiencia</span>
            <input type="number" min={0} max={6} className="field" value={proficiency} onChange={(event) => setProficiency(Math.max(0, Number(event.target.value || 0)))} />
          </label>

          <div className="space-y-2 rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Experiencias</p>
              <Button variant="secondary" className="gap-2" onClick={addExperience}>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
            {experiences.map((item, index) => (
              <div key={`exp-${index}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <input className="field" value={item.label} onChange={(event) => updateExperience(index, { label: event.target.value })} placeholder="Ex.: Sobrevivente das Montanhas" />
                <input type="number" className="field" value={item.bonus} onChange={(event) => updateExperience(index, { bonus: Number(event.target.value || 0) })} />
                <Button variant="ghost" onClick={() => removeExperience(index)}>Remover</Button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-xs text-white/55">Esperanca atual</span><input type="number" min={0} className="field" value={hope} onChange={(event) => setHope(Math.max(0, Number(event.target.value || 0)))} /></label>
            <label className="space-y-1"><span className="text-xs text-white/55">Esperanca maxima</span><input type="number" min={1} className="field" value={hopeMax} onChange={(event) => setHopeMax(Math.max(1, Number(event.target.value || 1)))} /></label>
            <label className="space-y-1"><span className="text-xs text-white/55">Fadiga atual</span><input type="number" min={0} className="field" value={fatigue} onChange={(event) => setFatigue(Math.max(0, Number(event.target.value || 0)))} /></label>
            <label className="space-y-1"><span className="text-xs text-white/55">Fadiga maxima</span><input type="number" min={1} className="field" value={fatigueMax} onChange={(event) => setFatigueMax(Math.max(1, Number(event.target.value || 1)))} /></label>
            <label className="space-y-1"><span className="text-xs text-white/55">Estresse atual</span><input type="number" min={0} className="field" value={stress} onChange={(event) => setStress(Math.max(0, Number(event.target.value || 0)))} /></label>
            <label className="space-y-1"><span className="text-xs text-white/55">Estresse maximo</span><input type="number" min={1} className="field" value={stressMax} onChange={(event) => setStressMax(Math.max(1, Number(event.target.value || 1)))} /></label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-xs text-white/55">Ouro</span><input type="number" min={0} className="field" value={gold} onChange={(event) => setGold(Math.max(0, Number(event.target.value || 0)))} /></label>
            <label className="space-y-1"><span className="text-xs text-white/55">Formas druidas (uma por linha)</span><textarea className="field min-h-20 resize-y py-3" value={druidFormsText} onChange={(event) => setDruidFormsText(event.target.value)} placeholder={"Lobo da Lua\nCoruja Cinzenta"} /></label>
          </div>

          <label className="space-y-1">
            <span className="text-xs text-white/55">Anotacoes</span>
            <textarea className="field min-h-24 resize-y py-3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ligacoes, origem e observacoes relevantes" />
          </label>
        </SurfaceCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SurfaceCard className="space-y-4">
          <div className="flex items-center gap-2"><Sword className="h-4 w-4 text-[var(--accent)]" /><h3 className="text-lg font-semibold text-white">Itens do livro</h3></div>
          <p className="text-sm text-white/60">{equipmentRules.weapon_selection.summary}</p>
          <p className="text-xs text-white/45">{equipmentRules.weapon_selection.proficiency_rule}</p>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Arma primaria</p>
              {equipment.primaryWeapon ? (<div className="mt-2 space-y-2"><p className="text-sm font-semibold text-white">{equipment.primaryWeapon.name}</p><p className="text-xs text-white/55">{equipmentText(equipment.primaryWeapon)}</p>{equipment.primaryWeapon.ability ? <p className="text-xs text-[var(--accent)]">{equipment.primaryWeapon.ability}</p> : null}</div>) : (<p className="mt-2 text-xs text-white/50">Nenhuma arma selecionada.</p>)}
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => openItemModal("primaryWeapon", "Selecionar item")}
              >
                Itens
              </Button>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Arma secundaria</p>
              {equipment.secondaryWeapon ? (<div className="mt-2 space-y-2"><p className="text-sm font-semibold text-white">{equipment.secondaryWeapon.name}</p><p className="text-xs text-white/55">{equipmentText(equipment.secondaryWeapon)}</p>{equipment.secondaryWeapon.ability ? <p className="text-xs text-[var(--accent)]">{equipment.secondaryWeapon.ability}</p> : null}</div>) : (<p className="mt-2 text-xs text-white/50">Nenhuma arma selecionada.</p>)}
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => openItemModal("secondaryWeapon", "Selecionar item")}
              >
                Itens
              </Button>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-[0.22em] text-white/45">Armadura</p>
              {equipment.armor ? (<div className="mt-2 space-y-2"><p className="text-sm font-semibold text-white">{equipment.armor.name}</p><p className="text-xs text-white/55">{equipmentText(equipment.armor)}</p>{equipment.armor.ability ? <p className="text-xs text-[var(--accent)]">{equipment.armor.ability}</p> : null}</div>) : (<p className="mt-2 text-xs text-white/50">Nenhuma armadura selecionada.</p>)}
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => openItemModal("armor", "Selecionar item")}
              >
                Itens
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Inventario</p>
              <Button variant="ghost" onClick={() => setEquipment((current) => ({ ...current, inventory: [...equipmentRules.default_inventory] }))}>Restaurar padrao</Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {equipment.inventory.map((item) => (
                <button key={item} className="rounded-full border border-white/12 bg-white/7 px-3 py-1 text-xs text-white/70" onClick={() => removeInventoryItem(item)} title="Clique para remover">{item}</button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input className="field" value={newInventoryItem} onChange={(event) => setNewInventoryItem(event.target.value)} placeholder="Adicionar item customizado" />
              <Button variant="secondary" onClick={addInventoryItem}>Adicionar</Button>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-4">
          <div className="flex items-center gap-2"><WandSparkles className="h-4 w-4 text-[var(--accent)]" /><h3 className="text-lg font-semibold text-white">Cartas e habilidades</h3></div>

          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white">Cartas automaticas</p><span className="text-xs text-white/50">{automaticCards.length} disponiveis</span></div>

            {automaticCards.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {automaticCards.map((card) => (
                  <div key={card.id} className="rounded-2xl border border-white/10 bg-white/6 p-3">
                    <p className="text-sm font-semibold text-white">{card.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">{categoryLabels[card.category]} {card.tier ? `| ${card.tier}` : ""}</p>
                    <p className="mt-2 line-clamp-4 text-xs leading-6 text-white/65">{card.text}</p>
                    {card.sourcePdfKey ? <iframe title={`Carta ${card.name}`} src={`/api/files/${card.sourcePdfKey}#page=${card.sourcePage ?? 1}`} className="mt-3 h-44 w-full rounded-xl border border-white/10 bg-white" /> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/55">Nenhuma carta automatica encontrada para essa combinacao. Rode a sincronizacao de cartas de referencia se necessario.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white">Cartas de dominio (escolha ate 2)</p><span className="text-xs text-white/50">{selectedDomainCardIds.length}/2 selecionadas</span></div>

            <div className="mt-3 grid max-h-[26rem] gap-2 overflow-auto pr-1">
              {availableDomainCards.map((card) => {
                const selected = selectedDomainCardIds.includes(card.id);
                const disabled = !selected && selectedDomainCardIds.length >= 2;

                return (
                  <button key={card.id} className={`rounded-2xl border px-3 py-3 text-left transition ${selected ? "border-[var(--accent)] bg-[rgba(213,177,106,0.2)]" : "border-white/10 bg-white/6"} ${disabled ? "opacity-50" : "hover:border-white/20"}`} disabled={disabled} onClick={() => toggleDomainCard(card.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{card.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">{card.tier ?? "Sem tier"} {card.domainKey ? `| ${domainMap[card.domainKey] ?? card.domainKey}` : ""}</p>
                        <p className="mt-2 line-clamp-2 text-xs leading-6 text-white/65">{card.text}</p>
                      </div>
                      {selected ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {!availableDomainCards.length ? <p className="mt-3 text-sm text-white/55">Nao foi encontrada carta de dominio para a classe atual. Importe as cartas do baralho para preencher esta lista.</p> : null}
          </div>
        </SurfaceCard>
      </section>

      <SurfaceCard className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Salvar personagem</h3>
            <p className="text-sm text-white/55">Cartas automaticas por classe/subclasse/heranca serao vinculadas automaticamente no backend.</p>
          </div>
          <Button onClick={createCharacter} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {submitting ? "Salvando..." : "Criar personagem"}
          </Button>
        </div>

        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </SurfaceCard>

      <Modal open={Boolean(itemModal)} title={itemModal?.title ?? "Selecionar item"} onClose={() => setItemModal(null)}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {itemTierOptions.map((tier) => (
              <button
                key={tier.key}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  itemTier === tier.key
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "bg-white/6 text-white/65"
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
              onChange={(event) => setItemSearch(event.target.value)}
            />
            {itemModal?.slot === "primaryWeapon" ? (
              <div className="flex gap-2">
                {([
                  ["all", "Todos"],
                  ["physical", "Fisico"],
                  ["magical", "Magico"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      itemTypeFilter === key
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "bg-white/6 text-white/65"
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
                  <p className="text-sm font-semibold text-[var(--accent)]">Fisico</p>
                  <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
                    {filteredPrimaryPhysical.length ? (
                      filteredPrimaryPhysical.map((item) => (
                        <button
                          key={item.name}
                          className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-white/20"
                          onClick={() => pickItem(item)}
                        >
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-xs text-white/60">{equipmentText(item)}</p>
                          {item.ability ? (
                            <p className="mt-2 text-xs text-[var(--accent)]">{item.ability}</p>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-white/55">Sem itens para este tier/filtro.</p>
                    )}
                  </div>
                </div>
              )}

              {(itemTypeFilter === "all" || itemTypeFilter === "magical") && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--accent)]">Magico</p>
                  <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
                    {filteredPrimaryMagical.length ? (
                      filteredPrimaryMagical.map((item) => (
                        <button
                          key={item.name}
                          className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-white/20"
                          onClick={() => pickItem(item)}
                        >
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-xs text-white/60">{equipmentText(item)}</p>
                          {item.ability ? (
                            <p className="mt-2 text-xs text-[var(--accent)]">{item.ability}</p>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-white/55">Sem itens para este tier/filtro.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {itemModal?.slot === "secondaryWeapon" ? (
            <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
              {filteredSecondary.length ? (
                filteredSecondary.map((item) => (
                  <button
                    key={item.name}
                    className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-white/20"
                    onClick={() => pickItem(item)}
                  >
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-xs text-white/60">{equipmentText(item)}</p>
                    {item.ability ? (
                      <p className="mt-2 text-xs text-[var(--accent)]">{item.ability}</p>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="text-sm text-white/55">Sem itens para este tier.</p>
              )}
            </div>
          ) : null}

          {itemModal?.slot === "armor" ? (
            <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
              {filteredArmor.length ? (
                filteredArmor.map((item) => (
                  <button
                    key={item.name}
                    className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-white/20"
                    onClick={() => pickItem(item)}
                  >
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="mt-1 text-xs text-white/60">{equipmentText(item)}</p>
                    {item.ability ? (
                      <p className="mt-2 text-xs text-[var(--accent)]">{item.ability}</p>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="text-sm text-white/55">Sem itens para este tier.</p>
              )}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
