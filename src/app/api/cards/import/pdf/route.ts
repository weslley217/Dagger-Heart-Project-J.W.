import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { extractCardsFromPdfBuffer, importCards } from "@/lib/card-import";
import { requireApiSession, jsonError } from "@/lib/api-session";
import { buildStoredFileKey, saveReferenceFile } from "@/lib/storage";

export async function POST(request: Request) {
  const auth = await requireApiSession("MASTER");
  if ("error" in auth) {
    return auth.error;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("Envie um arquivo PDF válido.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = buildStoredFileKey(file.name, "cards");

  await saveReferenceFile(fileKey, buffer);
  const cards = await extractCardsFromPdfBuffer(buffer, fileKey);
  const imported = await importCards(cards);

  revalidatePath("/master/import");
  revalidatePath("/master");
  revalidatePath("/player");

  return NextResponse.json({
    message: `${imported} carta(s) importada(s) do PDF.`,
  });
}
