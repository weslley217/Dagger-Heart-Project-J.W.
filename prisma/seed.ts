import "dotenv/config";

import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { toJson } from "@/lib/utils";

async function main() {
  const campaign = await db.campaign.upsert({
    where: { id: "campanha-local" },
    update: {
      name: "Sala Local",
      isDefault: true,
    },
    create: {
      id: "campanha-local",
      name: "Sala Local",
      isDefault: true,
    },
  });

  const joao = await db.user.upsert({
    where: { username: "joão" },
    update: {
      displayName: "João",
      passwordHash: hashPassword("1234"),
      role: "PLAYER",
    },
    create: {
      username: "joão",
      displayName: "João",
      passwordHash: hashPassword("1234"),
      role: "PLAYER",
    },
  });

  await db.user.upsert({
    where: { username: "mestre" },
    update: {
      displayName: "Mestre",
      passwordHash: hashPassword("1234"),
      role: "MASTER",
    },
    create: {
      username: "mestre",
      displayName: "Mestre",
      passwordHash: hashPassword("1234"),
      role: "MASTER",
    },
  });

  const cards = [
    {
      id: "DH Básico 001/270",
      name: "Trovador",
      category: "subclasse",
      classKey: "bardo",
      subclassKey: "trovador",
      tier: "Fundamental",
      text: "Artista Talentoso: descreva como você se apresenta para as pessoas. Você pode cantar canções uma vez por descanso longo e apoiar aliados próximos.",
      keywords: toJson(["Esperança", "suporte"]),
      effects: toJson([
        { type: "custom_handler", handler: "bard_inspiration" },
        { type: "uses_per_rest", uses: 1 },
      ]),
      customHandler: "bard_inspiration",
    },
    {
      id: "DH Básico 007/270",
      name: "Beletrista",
      category: "subclasse",
      classKey: "bardo",
      subclassKey: "beletrista",
      tier: "Fundamental",
      text: "Discurso Inspirador: uma vez por descanso longo, você pode fazer um discurso emocionante e inspirador. Todos os aliados até o alcance distante recuperam 2 Pontos de Fadiga.",
      keywords: toJson(["Fadiga", "Esperança"]),
      effects: toJson([
        { type: "grant_resource", resource: "fatigue", amount: -2, mode: "recover" },
        { type: "uses_per_rest", uses: 1 },
      ]),
      customHandler: null,
    },
    {
      id: "DH Básico 025/270",
      name: "Baluarte",
      category: "subclasse",
      classKey: "guardiao",
      subclassKey: "baluarte",
      tier: "Fundamental",
      text: "Resoluto: você recebe um bônus permanente de +1 em seus limiares de dano. Vontade de Ferro: ao sofrer dano físico, você pode marcar 1 Ponto de Armadura adicional para reduzir a gravidade.",
      keywords: toJson(["limiar", "armadura"]),
      effects: toJson([
        { type: "modify_thresholds", amount: 1 },
        { type: "modify_damage", amount: -1, reason: "Armadura extra do Baluarte" },
      ]),
      customHandler: null,
    },
  ] as const;

  for (const card of cards) {
    await db.card.upsert({
      where: { id: card.id },
      update: card,
      create: card,
    });
  }

  const characters = [
    {
      id: "char-joao-trovador",
      campaignId: campaign.id,
      ownerId: joao.id,
      name: "João das Marés",
      level: 1,
      shortDescription: "Bardo viajante que sustenta o grupo com presença e música.",
      classKey: "bardo",
      subclassKey: "trovador",
      ancestryKey: "humano",
      communityKey: "maritima",
      domains: toJson(["codice", "graca"]),
      attributes: toJson({
        agility: 1,
        strength: 0,
        finesse: 1,
        instinct: 0,
        presence: 2,
        knowledge: 1,
      }),
      proficiencies: toJson({
        proficiency: 1,
        experiences: [
          { label: "Músico de Convés", bonus: 2 },
          { label: "Navegador Costeiro", bonus: 2 },
        ],
      }),
      conditions: toJson(["Inspirado"]),
      resources: toJson({
        hope: 3,
        hopeMax: 6,
        fatigue: 1,
        fatigueMax: 6,
        gold: 12,
        stress: 1,
        stressMax: 6,
      }),
      totalHp: 5,
      currentHp: 1,
      armorMax: 2,
      armorCurrent: 2,
      threshold1: 6,
      threshold2: 12,
      evasion: 10,
      notes: "Ficha seed com foco em suporte e cartas de subclasse.",
      isDowned: false,
    },
    {
      id: "char-lia-baluarte",
      campaignId: campaign.id,
      ownerId: joao.id,
      name: "Lia Muralha",
      level: 1,
      shortDescription: "Guardiã obstinada que segura a linha de frente.",
      classKey: "guardiao",
      subclassKey: "baluarte",
      ancestryKey: "galapa",
      communityKey: "montanhesa",
      domains: toJson(["valor", "lamina"]),
      attributes: toJson({
        agility: 0,
        strength: 2,
        finesse: -1,
        instinct: 1,
        presence: 0,
        knowledge: 0,
      }),
      proficiencies: toJson({
        proficiency: 1,
        experiences: [
          { label: "Escudo de Passagem", bonus: 2 },
          { label: "Milícia da Escarpa", bonus: 2 },
        ],
      }),
      conditions: toJson(["Determinado"]),
      resources: toJson({
        hope: 2,
        hopeMax: 6,
        fatigue: 2,
        fatigueMax: 6,
        gold: 8,
        stress: 2,
        stressMax: 6,
      }),
      totalHp: 7,
      currentHp: 2,
      armorMax: 4,
      armorCurrent: 3,
      threshold1: 8,
      threshold2: 16,
      evasion: 9,
      notes: "Exemplo voltado para uso do simulador de dano.",
      isDowned: false,
    },
  ] as const;

  for (const character of characters) {
    await db.character.upsert({
      where: { id: character.id },
      update: character,
      create: character,
    });
  }

  const links = [
    {
      characterId: "char-joao-trovador",
      cardId: "DH Básico 001/270",
      status: "ativa",
      usesMax: 1,
      usesCurrent: 1,
    },
    {
      characterId: "char-lia-baluarte",
      cardId: "DH Básico 025/270",
      status: "passiva",
      usesMax: null,
      usesCurrent: null,
    },
    {
      characterId: "char-joao-trovador",
      cardId: "DH Básico 007/270",
      status: "passiva",
      usesMax: 1,
      usesCurrent: 1,
    },
  ];

  for (const link of links) {
    await db.characterCard.upsert({
      where: {
        characterId_cardId: {
          characterId: link.characterId,
          cardId: link.cardId,
        },
      },
      update: link,
      create: link,
    });
  }
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
