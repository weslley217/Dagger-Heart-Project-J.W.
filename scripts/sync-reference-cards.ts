import "dotenv/config";

import { attachReferenceCardImages, buildReferenceCards } from "@/lib/reference-cards";
import { assertDb, db } from "@/lib/db";

async function main() {
  const importedCards = (assertDb(
    await db
      .from("cards")
      .select("*")
      .not("source_pdf_key", "is", null)
      .not("source_page", "is", null),
    "Falha ao carregar cartas importadas para vinculo de imagem.",
  ) ?? []) as Array<Record<string, unknown>>;

  const referenceCards = buildReferenceCards();
  const cardsWithImages = attachReferenceCardImages(referenceCards, importedCards);

  const payload = cardsWithImages.map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    type: "ability",
    class_key: card.class_key ?? null,
    subclass_key: card.subclass_key ?? null,
    domain_key: null,
    tier: card.tier ?? null,
    text: card.text,
    keywords: card.keywords,
    image_url: null,
    source_pdf_key: card.source_pdf_key ?? null,
    source_page: card.source_page ?? null,
    effects: card.effects,
    custom_handler: null,
    tag_key: card.tag_key ?? null,
  }));

  assertDb(
    await db.from("cards").upsert(payload, { onConflict: "id" }),
    "Falha ao salvar cartas de referencia.",
  );

  const categoryCount = payload.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    `Cartas de referencia sincronizadas: ${payload.length} (${Object.entries(categoryCount)
      .map(([category, count]) => `${category}=${count}`)
      .join(", ")})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
