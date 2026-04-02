import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { extractCardsFromPdfBuffer, importCards } from "@/lib/card-import";
import { buildStoredFileKey, saveReferenceFile } from "@/lib/storage";

async function main() {
  const inputPath =
    process.argv[2] ?? "C:\\Users\\wesll\\Downloads\\DH-Baralho.pdf";

  const buffer = await readFile(inputPath);
  const fileKey = buildStoredFileKey(path.basename(inputPath), "cards");

  await saveReferenceFile(fileKey, buffer);
  const cards = await extractCardsFromPdfBuffer(buffer, fileKey);
  const count = await importCards(cards);

  console.log(`Importadas ${count} cartas a partir de ${inputPath}.`);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
