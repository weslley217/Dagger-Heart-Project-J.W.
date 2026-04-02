import sourceData from "../../daggerheart_criacao_personagem.json";

import { getAncestryLabelByKey, getCommunityLabelByKey } from "@/lib/reference-data";
import { slugify } from "@/lib/utils";
import type { CardCategory, CardEffect, CardSummary } from "@/types/domain";

type SourceClass = {
  name: string;
  class_features?: Array<{ name?: string; effect?: string }>;
  hope_feature?: {
    name?: string;
    effect?: string;
    cost_hope?: number;
  };
  subclasses?: Array<{
    name: string;
    fundamental?: string[];
    specialization?: string[];
    mastery?: string[];
  }>;
};

type SourceAncestry = {
  name: string;
  abilities?: string[];
};

type SourceCommunity = {
  name: string;
  ability?: string;
};

type RawReferenceCard = {
  id: string;
  name: string;
  category: CardCategory;
  class_key?: string | null;
  subclass_key?: string | null;
  tag_key?: string | null;
  tier?: string | null;
  text: string;
  keywords: string[];
  effects: CardEffect[];
};

const keywordDictionary = [
  "Vulneravel",
  "Esperanca",
  "cura",
  "armadura",
  "limiar",
  "fadiga",
  "oculto",
  "imobilizado",
  "marcado",
  "voo",
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function deriveKeywords(text: string) {
  const lowered = normalize(text);
  return [
    ...new Set(
      keywordDictionary.filter((keyword) => lowered.includes(normalize(keyword))),
    ),
  ];
}

function inferEffectsFromText(text: string): CardEffect[] {
  const effects: CardEffect[] = [];
  const normalized = text.replace(/\s+/g, " ");

  const hpMatch = normalized.match(/recupera(?:r|m)?\s+(\d+)\s+PV/i);
  if (hpMatch) {
    effects.push({
      type: "heal_hp",
      amount: Number(hpMatch[1]),
    });
  }

  const fatigueMatch = normalized.match(/recupera(?:r|m)?\s+(\d+)\s+Pontos? de Fadiga/i);
  if (fatigueMatch) {
    effects.push({
      type: "grant_resource",
      resource: "fatigue",
      amount: -Number(fatigueMatch[1]),
      mode: "recover",
    });
  }

  const hopeMatch = normalized.match(/receb(?:e|em)\s+(\d+)\s+Ponto(?:s)? de Esperan/gi);
  if (hopeMatch) {
    effects.push({
      type: "grant_resource",
      resource: "hope",
      amount: 1,
      mode: "gain",
    });
  }

  const thresholdMatch = normalized.match(/b[ôo]nus permanente de \+(\d+)\s+em seus limiares/i);
  if (thresholdMatch) {
    effects.push({
      type: "modify_thresholds",
      amount: Number(thresholdMatch[1]),
    });
  }

  if (/vulner[aá]vel/i.test(normalized)) {
    effects.push({
      type: "apply_condition",
      condition: "Vulneravel",
      temporary: true,
    });
  }

  if (/uma vez por descanso/i.test(normalized)) {
    effects.push({
      type: "uses_per_rest",
      uses: 1,
    });
  }

  return effects;
}

function splitAbility(line: string) {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { title: "Habilidade", text: "" };
  }

  const parts = normalized.split(":");
  if (parts.length >= 2) {
    return {
      title: parts[0].trim(),
      text: normalized,
    };
  }

  return {
    title: normalized.slice(0, 48),
    text: normalized,
  };
}

export function buildReferenceCards() {
  const sourceClasses = sourceData.classes as SourceClass[];
  const sourceAncestries = sourceData.ancestries as SourceAncestry[];
  const sourceCommunities = sourceData.communities as SourceCommunity[];

  const cards: RawReferenceCard[] = [];

  sourceClasses.forEach((klass) => {
    const classKey = slugify(klass.name);
    let classCardIndex = 1;

    if (klass.hope_feature?.effect) {
      const title = klass.hope_feature.name?.trim() || "Tecnica de Esperanca";
      const text = `${title}: ${klass.hope_feature.effect}`.trim();
      cards.push({
        id: `REF-CLASS-${classKey}-${classCardIndex++}`,
        name: `${klass.name} · ${title}`,
        category: "classe",
        class_key: classKey,
        tag_key: `class:${classKey}`,
        tier: "Fundamental",
        text,
        keywords: deriveKeywords(text),
        effects: inferEffectsFromText(text),
      });
    }

    (klass.class_features ?? []).forEach((feature) => {
      const title = feature.name?.trim() || "Recurso de Classe";
      const text = feature.effect ? `${title}: ${feature.effect}` : title;
      cards.push({
        id: `REF-CLASS-${classKey}-${classCardIndex++}`,
        name: `${klass.name} · ${title}`,
        category: "classe",
        class_key: classKey,
        tag_key: `class:${classKey}`,
        tier: "Fundamental",
        text,
        keywords: deriveKeywords(text),
        effects: inferEffectsFromText(text),
      });
    });

    (klass.subclasses ?? []).forEach((subclass) => {
      const subclassKey = slugify(subclass.name);
      const groups: Array<{ tier: string; lines: string[] | undefined }> = [
        { tier: "Fundamental", lines: subclass.fundamental },
        { tier: "Especializacao", lines: subclass.specialization },
        { tier: "Maestria", lines: subclass.mastery },
      ];

      let subCardIndex = 1;
      groups.forEach((group) => {
        (group.lines ?? []).forEach((line) => {
          const parsed = splitAbility(line);
          cards.push({
            id: `REF-SUBCLASS-${subclassKey}-${group.tier}-${subCardIndex++}`,
            name: `${subclass.name} · ${parsed.title}`,
            category: "subclasse",
            class_key: classKey,
            subclass_key: subclassKey,
            tag_key: `subclass:${subclassKey}`,
            tier: group.tier,
            text: parsed.text,
            keywords: deriveKeywords(parsed.text),
            effects: inferEffectsFromText(parsed.text),
          });
        });
      });
    });
  });

  sourceAncestries.forEach((ancestry) => {
    const ancestryKey = slugify(ancestry.name);
    (ancestry.abilities ?? []).forEach((line, index) => {
      const parsed = splitAbility(line);
      cards.push({
        id: `REF-ANCESTRY-${ancestryKey}-${index + 1}`,
        name: `${ancestry.name} · ${parsed.title}`,
        category: "ancestralidade",
        tag_key: `ancestry:${ancestryKey}`,
        tier: "Fundamental",
        text: parsed.text,
        keywords: deriveKeywords(parsed.text),
        effects: inferEffectsFromText(parsed.text),
      });
    });
  });

  sourceCommunities.forEach((community) => {
    const communityKey = slugify(community.name);
    const text = community.ability?.trim();
    if (!text) {
      return;
    }
    const parsed = splitAbility(text);
    cards.push({
      id: `REF-COMMUNITY-${communityKey}`,
      name: `${community.name} · ${parsed.title}`,
      category: "comunidade",
      tag_key: `community:${communityKey}`,
      tier: "Fundamental",
      text: parsed.text,
      keywords: deriveKeywords(parsed.text),
      effects: inferEffectsFromText(parsed.text),
    });
  });

  return cards;
}

function matchScore(referenceText: string, candidateText: string, candidateName: string) {
  const ref = normalize(referenceText);
  const candidate = normalize(candidateText);
  const candidateTitle = normalize(candidateName);

  const [head] = ref.split(":");
  const headTokens = head.split(/\s+/).filter((token) => token.length >= 4).slice(0, 4);
  const bodySnippet = ref.slice(0, 120);

  let score = 0;
  if (headTokens.some((token) => candidate.includes(token) || candidateTitle.includes(token))) {
    score += 2;
  }
  if (candidate.includes(bodySnippet.slice(0, 40))) {
    score += 2;
  }
  if (headTokens.every((token) => candidate.includes(token) || candidateTitle.includes(token))) {
    score += 3;
  }
  return score;
}

export function attachReferenceCardImages(
  referenceCards: RawReferenceCard[],
  importedCards: Array<Record<string, unknown>>,
) {
  return referenceCards.map((referenceCard) => {
    let bestMatch: Record<string, unknown> | null = null;
    let bestScore = 0;

    for (const importedCard of importedCards) {
      const text = String(importedCard.text ?? "");
      const name = String(importedCard.name ?? "");
      const score = matchScore(referenceCard.text, text, name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = importedCard;
      }
    }

    return {
      ...referenceCard,
      source_pdf_key:
        bestScore >= 3 ? ((bestMatch?.source_pdf_key as string | null | undefined) ?? null) : null,
      source_page:
        bestScore >= 3 ? ((bestMatch?.source_page as number | null | undefined) ?? null) : null,
    };
  });
}

export function isAutomaticCardForSelection(
  card: Pick<CardSummary, "category" | "classKey" | "subclassKey" | "name" | "tagKey">,
  options: {
    classKey: string;
    subclassKey: string;
    ancestryKey: string;
    communityKey: string;
  },
) {
  if (card.classKey && card.classKey === options.classKey) {
    return true;
  }

  if (card.subclassKey && card.subclassKey === options.subclassKey) {
    return true;
  }

  if (card.tagKey === `ancestry:${options.ancestryKey}`) {
    return true;
  }
  if (card.tagKey === `community:${options.communityKey}`) {
    return true;
  }

  if (card.category === "ancestralidade") {
    const ancestryLabel = getAncestryLabelByKey(options.ancestryKey);
    const normalizedName = normalize(card.name);
    if (normalizedName.includes(normalize(ancestryLabel))) {
      return true;
    }
  }

  if (card.category === "comunidade") {
    const communityLabel = getCommunityLabelByKey(options.communityKey);
    const normalizedName = normalize(card.name);
    if (normalizedName.includes(normalize(communityLabel))) {
      return true;
    }
  }

  return false;
}
