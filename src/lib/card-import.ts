import { z } from "zod";

import { assertDb, db } from "@/lib/db";
import { ancestries, classes, communities, getSubclassReference } from "@/lib/reference-data";
import { slugify } from "@/lib/utils";
import type { CardCategory, CardEffect, ImportCardInput } from "@/types/domain";

const cardEffectSchema = z.union([
  z.object({
    type: z.literal("grant_resource"),
    resource: z.enum(["hope", "fatigue", "armor", "stress"]),
    amount: z.number(),
    mode: z.enum(["gain", "recover"]).optional(),
  }),
  z.object({
    type: z.literal("heal_hp"),
    amount: z.number(),
  }),
  z.object({
    type: z.literal("apply_condition"),
    condition: z.string(),
    temporary: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("modify_thresholds"),
    amount: z.number(),
  }),
  z.object({
    type: z.literal("modify_damage"),
    amount: z.number(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("uses_per_rest"),
    uses: z.number(),
  }),
  z.object({
    type: z.literal("custom_handler"),
    handler: z.string(),
  }),
]);

const importCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["classe", "subclasse", "dominio", "comunidade", "ancestralidade", "outros"]),
  type: z.string().nullable().optional(),
  classKey: z.string().nullable().optional(),
  subclassKey: z.string().nullable().optional(),
  domainKey: z.string().nullable().optional(),
  tier: z.string().nullable().optional(),
  text: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  imageUrl: z.string().nullable().optional(),
  sourcePdfKey: z.string().nullable().optional(),
  sourcePage: z.number().nullable().optional(),
  effects: z.array(cardEffectSchema).optional(),
  customHandler: z.string().nullable().optional(),
});

const keywordDictionary = [
  "Vulnerável",
  "Esperança",
  "cura",
  "armadura",
  "limiar",
  "fadiga",
  "oculto",
  "imobilizado",
  "marcado",
  "voo",
];

export function deriveKeywords(text: string) {
  const lowered = text.toLowerCase();
  return [...new Set(keywordDictionary.filter((keyword) => lowered.includes(keyword.toLowerCase())))];
}

export function inferEffectsFromText(text: string): CardEffect[] {
  const effects: CardEffect[] = [];
  const normalized = text.replace(/\s+/g, " ");

  const pvMatch = normalized.match(/recupera(?:r|m)?\s+(\d+)\s+PV/i);
  if (pvMatch) {
    effects.push({
      type: "heal_hp",
      amount: Number(pvMatch[1]),
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

  const hopeMatch = normalized.match(/receb(?:e|em)\s+(\d+)\s+Ponto(?:s)? de Esperança/i);
  if (hopeMatch) {
    effects.push({
      type: "grant_resource",
      resource: "hope",
      amount: Number(hopeMatch[1]),
      mode: "gain",
    });
  }

  const thresholdMatch = normalized.match(/b[oô]nus permanente de \+(\d+)\s+em seus limiares/i);
  if (thresholdMatch) {
    effects.push({
      type: "modify_thresholds",
      amount: Number(thresholdMatch[1]),
    });
  }

  if (/vulner[aá]vel/i.test(normalized)) {
    effects.push({
      type: "apply_condition",
      condition: "Vulnerável",
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

function normalizeName(name: string) {
  return slugify(name);
}

function inferCategory(title: string): {
  category: CardCategory;
  classKey?: string;
  subclassKey?: string;
} {
  const key = normalizeName(title);
  const subclass = getSubclassReference(key);

  if (subclass) {
    return {
      category: "subclasse",
      classKey: subclass.classKey,
      subclassKey: subclass.key,
    };
  }

  const characterClass = classes.find((item) => item.key === key);
  if (characterClass) {
    return {
      category: "classe",
      classKey: characterClass.key,
    };
  }

  if (ancestries.some((item) => normalizeName(item) === key)) {
    return { category: "ancestralidade" };
  }

  if (communities.some((item) => normalizeName(item) === key)) {
    return { category: "comunidade" };
  }

  return { category: "outros" };
}

function parsePdfLines(items: Array<{ str?: string }>) {
  return items
    .map((item) => item.str?.trim() ?? "")
    .filter(Boolean)
    .filter((line, index, all) => all.indexOf(line) === index || index < 8);
}

export async function extractCardsFromPdfBuffer(buffer: Buffer, sourcePdfKey: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const document = await loadingTask.promise;
  const results: ImportCardInput[] = [];
  const tiers = ["Fundamental", "Especialização", "Maestria"];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 2) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = parsePdfLines(content.items as Array<{ str?: string }>);
    const joined = lines.join("\n");
    const idMatch = joined.match(/DH Básico\s+\d+\/\d+/i);

    if (!idMatch) {
      continue;
    }

    const title = lines.find(
      (line) =>
        !line.includes("Daggerheart") &&
        !line.includes("©") &&
        !tiers.includes(line) &&
        !line.includes("DH Básico"),
    );

    if (!title) {
      continue;
    }

    const tier = lines.find((line) => tiers.includes(line)) ?? null;
    const titleInfo = inferCategory(title);
    const bodyStart = tier ? lines.indexOf(tier) + 1 : Math.min(3, lines.length);
    const body = lines
      .slice(bodyStart)
      .filter((line) => !line.includes(idMatch[0]))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    results.push({
      id: idMatch[0].replace(/\s+/g, " ").trim(),
      name: title,
      category: titleInfo.category,
      classKey: titleInfo.classKey,
      subclassKey: titleInfo.subclassKey,
      tier,
      text: body,
      keywords: deriveKeywords(body),
      sourcePdfKey,
      sourcePage: pageNumber,
      effects: inferEffectsFromText(body),
      customHandler: normalizeName(title) === "trovador" ? "bard_inspiration" : null,
    });
  }

  return results;
}

export async function importCards(inputs: ImportCardInput[]) {
  const parsed = inputs.map((input) => importCardSchema.parse(input));
  const payload = parsed.map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    type: card.type ?? null,
    class_key: card.classKey ?? null,
    subclass_key: card.subclassKey ?? null,
    domain_key: card.domainKey ?? null,
    tier: card.tier ?? null,
    text: card.text,
    keywords: card.keywords ?? deriveKeywords(card.text),
    image_url: card.imageUrl ?? null,
    source_pdf_key: card.sourcePdfKey ?? null,
    source_page: card.sourcePage ?? null,
    effects: card.effects ?? inferEffectsFromText(card.text),
    custom_handler: card.customHandler ?? null,
  }));

  assertDb(
    await db.from("cards").upsert(payload, { onConflict: "id" }),
    "Falha ao importar cartas.",
  );

  return parsed.length;
}

export function parseCardJsonPayload(raw: string) {
  const parsed = JSON.parse(raw) as ImportCardInput[] | { cards: ImportCardInput[] };
  return Array.isArray(parsed) ? parsed : parsed.cards;
}
